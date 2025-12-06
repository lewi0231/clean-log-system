"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { mobileConfigKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
  ConditionalLogic,
  FieldConfig,
  FieldType,
  FormSectionWithFields,
  ValidationRules,
} from "@clean-log/shared";
import { useFieldConfigMutations } from "./use-field-config-mutations";
import { useSectionMutations } from "./use-section-mutations";

interface MobileConfigData {
  fieldConfigs: FieldConfig[];
  sections: FormSectionWithFields[];
}

async function fetchMobileConfig(
  organizationId: string,
): Promise<MobileConfigData> {
  log.debug("MobileConfig: Fetching field configs and sections");

  // Fetch both field configs and sections in parallel
  const [fieldConfigsResponse, sectionsResponse] = await Promise.all([
    supabase.functions.invoke("list-field-configs", {
      body: { organization_id: organizationId },
    }),
    supabase.functions.invoke("list-form-sections", {
      body: { organization_id: organizationId },
    }),
  ]);

  if (fieldConfigsResponse.error) {
    throw fieldConfigsResponse.error;
  }

  if (sectionsResponse.error) {
    throw sectionsResponse.error;
  }

  // Process field configs
  const configsWithDefaults = (
    fieldConfigsResponse.data?.field_configs || []
  ).map((fc: FieldConfig) => ({
    ...fc,
    section_id: fc.section_id ?? null,
    conditional_logic: fc.conditional_logic ?? null,
  }));

  // Process sections
  const sectionsWithFields: FormSectionWithFields[] = (
    sectionsResponse.data?.sections || []
  ).map((section: FormSectionWithFields) => ({
    ...section,
    field_ids: fieldConfigsResponse.data?.field_configs
      ?.filter((fc: FieldConfig) => fc.section_id === section.id)
      .map((fc: FieldConfig) => fc.id) || [],
  }));

  log.info("MobileConfig: Field configs and sections fetched successfully", {
    fieldConfigsCount: configsWithDefaults.length,
    sectionsCount: sectionsWithFields.length,
  });

  return {
    fieldConfigs: configsWithDefaults,
    sections: sectionsWithFields,
  };
}

export interface UseMobileConfigResult {
  fieldConfigs: FieldConfig[];
  optimisticFieldConfigs: FieldConfig[];
  sections: FormSectionWithFields[];
  loading: boolean;
  error: string | null;
  applyingTemplate: boolean;
  fetchFieldConfigs: () => Promise<void>;
  handleAddFieldConfig: (fieldConfigData: {
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
  }) => Promise<void>;
  handleUpdateFieldConfig: (
    fieldConfigId: string,
    fieldConfigData: Partial<FieldConfig>,
  ) => Promise<void>;
  handleDeleteFieldConfig: (fieldConfigId: string) => Promise<void>;
  handleReorderFieldConfigs: (fieldConfigIds: string[]) => Promise<void>;
  handleAddSection: (
    section: Omit<
      FormSectionWithFields,
      "id" | "organization_id" | "created_at" | "updated_at"
    >,
  ) => Promise<void>;
  handleUpdateSection: (
    sectionId: string,
    updates: Partial<FormSectionWithFields>,
  ) => Promise<void>;
  handleDeleteSection: (sectionId: string) => Promise<void>;
  handleReorderSections: (sectionIds: string[]) => Promise<void>;
  handleApplyTemplate: (
    businessMode: "service_based" | "resource_tracking",
    resetExisting?: boolean,
  ) => Promise<void>;
}

export function useMobileConfig(
  organizationId: string | null,
): UseMobileConfigResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: mobileConfigKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchMobileConfig(organizationId as string),
    placeholderData: (previous) => previous,
  });

  // Handle query errors
  useEffect(() => {
    if (query.error) {
      log.error("MobileConfig: Failed to fetch field configs", {
        error: query.error instanceof Error
          ? query.error.message
          : "Unknown error",
      });
    }
  }, [query.error]);

  const fieldConfigs = useMemo(
    () => (query.data?.fieldConfigs ?? []) as FieldConfig[],
    [query.data?.fieldConfigs],
  );
  const sections = useMemo(
    () => (query.data?.sections ?? []) as FormSectionWithFields[],
    [query.data?.sections],
  );

  const refetch = async () => {
    await query.refetch();
  };

  // Field config mutations
  const {
    optimisticFieldConfigs,
    handleAdd: handleAddFieldConfig,
    handleUpdate: handleUpdateFieldConfig,
    handleDelete: handleDeleteFieldConfig,
    handleReorder: handleReorderFieldConfigs,
  } = useFieldConfigMutations({
    organizationId,
    fieldConfigs,
    onRefetch: refetch,
  });

  // Section mutations
  const {
    handleAdd: handleAddSection,
    handleUpdate: handleUpdateSection,
    handleDelete: handleDeleteSection,
    handleReorder: handleReorderSections,
  } = useSectionMutations({
    organizationId,
    sections,
    onRefetch: refetch,
  });

  // Update section field_ids when field configs change
  useEffect(() => {
    if (sections.length > 0 && fieldConfigs.length > 0) {
      queryClient.setQueryData<MobileConfigData>(
        mobileConfigKey(organizationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            sections: old.sections.map((section) => ({
              ...section,
              field_ids: fieldConfigs
                .filter((fc: FieldConfig) => fc.section_id === section.id)
                .map((fc: FieldConfig) => fc.id),
            })),
          };
        },
      );
    }
  }, [fieldConfigs, sections.length, organizationId, queryClient]);

  const applyTemplateMutation = useMutation({
    mutationFn: async ({
      businessMode,
      resetExisting,
    }: {
      businessMode: "service_based" | "resource_tracking";
      resetExisting: boolean;
    }) => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }
      const { data, error } = await supabase.functions.invoke(
        "apply-field-config-template",
        {
          body: {
            organization_id: organizationId,
            business_mode: businessMode,
            reset_existing: resetExisting,
          },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: mobileConfigKey(organizationId),
      });
    },
  });

  const handleApplyTemplate = async (
    businessMode: "service_based" | "resource_tracking",
    resetExisting = false,
  ) => {
    if (!organizationId) return;

    try {
      log.info("MobileConfig: Applying template", {
        businessMode,
        resetExisting,
      });

      const data = await applyTemplateMutation.mutateAsync({
        businessMode,
        resetExisting,
      });

      if (data?.success) {
        await refetch();
        log.info("MobileConfig: Template applied successfully", {
          count: data.count,
          resetExisting,
        });
      }
    } catch (err) {
      log.error("MobileConfig: Failed to apply template", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  };

  return {
    fieldConfigs,
    optimisticFieldConfigs,
    sections,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    applyingTemplate: applyTemplateMutation.isPending,
    fetchFieldConfigs: () => query.refetch().then(() => undefined),
    handleAddFieldConfig,
    handleUpdateFieldConfig,
    handleDeleteFieldConfig,
    handleReorderFieldConfigs,
    handleAddSection,
    handleUpdateSection,
    handleDeleteSection,
    handleReorderSections,
    handleApplyTemplate,
  };
}
