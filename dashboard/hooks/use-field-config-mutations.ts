"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { mobileConfigKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { ConditionalLogic, FieldConfig, FieldType, ValidationRules } from "@clean-log/shared";

// Type for the cached mobile config data
type MobileConfigData = {
  fieldConfigs: FieldConfig[];
  sections: { id: string; field_ids: string[] }[];
};

interface UseFieldConfigMutationsOptions {
  organizationId: string | null;
  fieldConfigs: FieldConfig[];
  onRefetch?: () => Promise<void>;
}

/**
 * Hook for managing field config mutations with React Query's native optimistic updates.
 *
 * IMPORTANT: We use React Query's onMutate/onError/onSettled pattern instead of
 * React 19's useOptimistic hook because:
 * 1. React Query already manages the cache - mixing useOptimistic causes duplicates
 * 2. React Query's pattern provides automatic rollback on error
 * 3. No conflict between two state management systems
 */
export function useFieldConfigMutations({
  organizationId,
  fieldConfigs,
  onRefetch,
}: UseFieldConfigMutationsOptions) {
  const queryClient = useQueryClient();

  // Helper to get the query key
  const getQueryKey = useCallback(() => {
    return organizationId ? mobileConfigKey(organizationId) : null;
  }, [organizationId]);

  /** Keep Pricing (`useFieldConfigs`) in sync with Form Builder mutations. */
  const invalidateFieldConfigCaches = useCallback(() => {
    const mobileKey = getQueryKey();
    if (mobileKey) {
      queryClient.invalidateQueries({ queryKey: mobileKey });
    }
    if (organizationId) {
      // Prefix match: org-wide and any location-scoped field-configs caches
      queryClient.invalidateQueries({
        queryKey: ["field-configs", organizationId],
      });
    }
  }, [getQueryKey, organizationId, queryClient]);

  // Create mutation with optimistic update
  const createMutation = useMutation({
    mutationFn: async (fieldConfigData: {
      name: string;
      label: string;
      field_type: FieldType;
      description: string | null;
      required: boolean;
      validation_rules: ValidationRules | null;
      options: string[] | null;
      mutually_exclusive_group: string | null;
      group_cluster: string | null;
      section_id: string | null;
      conditional_logic: ConditionalLogic | null;
      order_position: number;
      _tempId: string; // Temp ID for optimistic update
    }) => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }
      const { error } = await supabase.functions.invoke("create-field-config", {
        body: {
          ...fieldConfigData,
          organization_id: organizationId,
        },
      });
      if (error) throw error;
      return { tempId: fieldConfigData._tempId };
    },
    // Optimistic update: immediately add to cache
    onMutate: async (newFieldConfig) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

      // Create the optimistic field config
      const optimisticFieldConfig: FieldConfig = {
        id: newFieldConfig._tempId,
        organization_id: organizationId!,
        name: newFieldConfig.name,
        label: newFieldConfig.label,
        field_type: newFieldConfig.field_type,
        description: newFieldConfig.description,
        required: newFieldConfig.required,
        validation_rules: newFieldConfig.validation_rules,
        options: newFieldConfig.options,
        mutually_exclusive_group: newFieldConfig.mutually_exclusive_group,
        group_cluster: newFieldConfig.group_cluster,
        section_id: newFieldConfig.section_id,
        conditional_logic: newFieldConfig.conditional_logic,
        order_position: newFieldConfig.order_position,
        version: 1,
        active: true,
        archived_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically update the cache
      queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          fieldConfigs: [...old.fieldConfigs, optimisticFieldConfig],
        };
      });

      // Return context for potential rollback
      return { previousData };
    },
    // Rollback on error
    onError: (err, _newFieldConfig, context) => {
      log.error("MobileConfig: Failed to create field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onRefetch?.();
    },
    // Always refetch after mutation to get real server data
    onSettled: () => {
      invalidateFieldConfigCaches();
    },
    onSuccess: () => {
      log.info("MobileConfig: Field config created successfully");
    },
  });

  // Update mutation with optimistic update
  const updateMutation = useMutation({
    mutationFn: async ({
      fieldConfigId,
      fieldConfigData,
    }: {
      fieldConfigId: string;
      fieldConfigData: Partial<FieldConfig>;
    }) => {
      const { error } = await supabase.functions.invoke("update-field-config", {
        body: {
          id: fieldConfigId,
          ...fieldConfigData,
        },
      });
      if (error) throw error;
      return { fieldConfigId };
    },
    onMutate: async ({ fieldConfigId, fieldConfigData }) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

      queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          fieldConfigs: old.fieldConfigs.map((fc) =>
            fc.id === fieldConfigId
              ? { ...fc, ...fieldConfigData, updated_at: new Date().toISOString() }
              : fc
          ),
        };
      });

      return { previousData };
    },
    onError: (err, _variables, context) => {
      log.error("MobileConfig: Failed to update field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onRefetch?.();
    },
    onSettled: () => {
      invalidateFieldConfigCaches();
    },
    onSuccess: () => {
      log.info("MobileConfig: Field config updated successfully");
    },
  });

  // Delete mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async (fieldConfigId: string) => {
      const { error } = await supabase.functions.invoke("delete-field-config", {
        body: { id: fieldConfigId },
      });
      if (error) throw error;
      return { fieldConfigId };
    },
    onMutate: async (fieldConfigId) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

      queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          fieldConfigs: old.fieldConfigs.filter((fc) => fc.id !== fieldConfigId),
        };
      });

      return { previousData };
    },
    onError: (err, _fieldConfigId, context) => {
      log.error("MobileConfig: Failed to delete field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onRefetch?.();
    },
    onSettled: () => {
      invalidateFieldConfigCaches();
    },
    onSuccess: () => {
      log.info("MobileConfig: Field config deleted successfully");
    },
  });

  // Reorder mutation with optimistic update
  const reorderMutation = useMutation({
    mutationFn: async (fieldConfigIds: string[]) => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }
      const { error } = await supabase.functions.invoke("reorder-field-configs", {
        body: {
          organization_id: organizationId,
          field_config_ids: fieldConfigIds,
        },
      });
      if (error) throw error;
      return { fieldConfigIds };
    },
    onMutate: async (fieldConfigIds) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

      queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
        if (!old) return old;
        const idToConfig = new Map(old.fieldConfigs.map((fc) => [fc.id, fc]));
        const reordered = fieldConfigIds
          .map((id) => idToConfig.get(id))
          .filter((fc): fc is FieldConfig => fc !== undefined);
        const remaining = old.fieldConfigs.filter((fc) => !fieldConfigIds.includes(fc.id));
        return {
          ...old,
          fieldConfigs: [...reordered, ...remaining],
        };
      });

      return { previousData };
    },
    onError: (err, _fieldConfigIds, context) => {
      log.error("MobileConfig: Failed to reorder field configs", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onRefetch?.();
    },
    onSettled: () => {
      invalidateFieldConfigCaches();
    },
    onSuccess: () => {
      log.info("MobileConfig: Field configs reordered successfully");
    },
  });

  // Handler functions that trigger the mutations
  const handleAdd = useCallback(
    (fieldConfigData: {
      name: string;
      label: string;
      field_type: FieldType;
      description: string | null;
      required: boolean;
      validation_rules: ValidationRules | null;
      options: string[] | null;
      mutually_exclusive_group: string | null;
      group_cluster: string | null;
      section_id: string | null;
      conditional_logic: ConditionalLogic | null;
      order_position: number;
    }) => {
      if (!organizationId) return;
      createMutation.mutate({
        ...fieldConfigData,
        _tempId: `temp-${Date.now()}`,
      });
    },
    [organizationId, createMutation]
  );

  const handleUpdate = useCallback(
    (fieldConfigId: string, fieldConfigData: Partial<FieldConfig>) => {
      updateMutation.mutate({ fieldConfigId, fieldConfigData });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (fieldConfigId: string) => {
      deleteMutation.mutate(fieldConfigId);
    },
    [deleteMutation]
  );

  const handleReorder = useCallback(
    (fieldConfigIds: string[]) => {
      if (!organizationId) return;
      reorderMutation.mutate(fieldConfigIds);
    },
    [organizationId, reorderMutation]
  );

  // Use the fieldConfigs directly from props (which comes from React Query cache)
  // The optimistic updates are applied directly to the cache via onMutate
  const optimisticFieldConfigs = useMemo(() => fieldConfigs, [fieldConfigs]);

  return {
    optimisticFieldConfigs,
    handleAdd,
    handleUpdate,
    handleDelete,
    handleReorder,
  };
}
