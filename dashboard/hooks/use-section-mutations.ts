"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { mobileConfigKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { FormSectionWithFields } from "@clean-log/shared";

// Type for the cached mobile config data
type MobileConfigData = {
    fieldConfigs: { id: string; section_id: string | null }[];
    sections: FormSectionWithFields[];
};

interface UseSectionMutationsOptions {
    organizationId: string | null;
    sections: FormSectionWithFields[];
    onRefetch?: () => Promise<void>;
}

/**
 * Hook for managing section mutations with React Query's native optimistic updates.
 * 
 * IMPORTANT: We use React Query's onMutate/onError/onSettled pattern instead of
 * React 19's useOptimistic hook because:
 * 1. React Query already manages the cache - mixing useOptimistic causes duplicates
 * 2. React Query's pattern provides automatic rollback on error
 * 3. No conflict between two state management systems
 */
export function useSectionMutations({
    organizationId,
    sections,
    onRefetch,
}: UseSectionMutationsOptions) {
    const queryClient = useQueryClient();

    // Helper to get the query key
    const getQueryKey = useCallback(() => {
        return organizationId ? mobileConfigKey(organizationId) : null;
    }, [organizationId]);

    // Create mutation with optimistic update
    const createMutation = useMutation({
        mutationFn: async (section: {
            title: string;
            description: string | null;
            order_position: number;
            collapsed_by_default: boolean;
            _tempId: string;
        }) => {
            if (!organizationId) {
                throw new Error("Organization ID is required");
            }
            const { error } = await supabase.functions.invoke(
                "create-form-section",
                {
                    body: {
                        organization_id: organizationId,
                        title: section.title,
                        description: section.description,
                        order_position: section.order_position,
                        collapsed_by_default: section.collapsed_by_default,
                    },
                },
            );
            if (error) throw error;
            return { tempId: section._tempId };
        },
        onMutate: async (newSection) => {
            const queryKey = getQueryKey();
            if (!queryKey) return;

            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

            const optimisticSection: FormSectionWithFields = {
                id: newSection._tempId,
                organization_id: organizationId!,
                title: newSection.title,
                description: newSection.description,
                order_position: newSection.order_position,
                collapsed_by_default: newSection.collapsed_by_default,
                field_ids: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: [...old.sections, optimisticSection],
                };
            });

            return { previousData };
        },
        onError: (err, _newSection, context) => {
            log.error("MobileConfig: Failed to create section", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            const queryKey = getQueryKey();
            if (queryKey && context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            onRefetch?.();
        },
        onSettled: () => {
            const queryKey = getQueryKey();
            if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
            }
        },
        onSuccess: () => {
            log.info("MobileConfig: Section created successfully");
        },
    });

    // Update mutation with optimistic update
    const updateMutation = useMutation({
        mutationFn: async ({
            sectionId,
            updates,
        }: {
            sectionId: string;
            updates: Partial<FormSectionWithFields>;
        }) => {
            const { error } = await supabase.functions.invoke(
                "update-form-section",
                {
                    body: {
                        id: sectionId,
                        ...updates,
                    },
                },
            );
            if (error) throw error;
            return { sectionId };
        },
        onMutate: async ({ sectionId, updates }) => {
            const queryKey = getQueryKey();
            if (!queryKey) return;

            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

            queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: old.sections.map((s) =>
                        s.id === sectionId
                            ? { ...s, ...updates, updated_at: new Date().toISOString() }
                            : s,
                    ),
                };
            });

            return { previousData };
        },
        onError: (err, _variables, context) => {
            log.error("MobileConfig: Failed to update section", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            const queryKey = getQueryKey();
            if (queryKey && context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            onRefetch?.();
        },
        onSettled: () => {
            const queryKey = getQueryKey();
            if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
            }
        },
        onSuccess: () => {
            log.info("MobileConfig: Section updated successfully");
        },
    });

    // Delete mutation with optimistic update
    const deleteMutation = useMutation({
        mutationFn: async (sectionId: string) => {
            const { error } = await supabase.functions.invoke(
                "delete-form-section",
                {
                    body: { id: sectionId },
                },
            );
            if (error) throw error;
            return { sectionId };
        },
        onMutate: async (sectionId) => {
            const queryKey = getQueryKey();
            if (!queryKey) return;

            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

            queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: old.sections.filter((s) => s.id !== sectionId),
                };
            });

            return { previousData };
        },
        onError: (err, _sectionId, context) => {
            log.error("MobileConfig: Failed to delete section", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            const queryKey = getQueryKey();
            if (queryKey && context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            onRefetch?.();
        },
        onSettled: () => {
            const queryKey = getQueryKey();
            if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
            }
        },
        onSuccess: () => {
            log.info("MobileConfig: Section deleted successfully");
        },
    });

    // Reorder mutation with optimistic update
    const reorderMutation = useMutation({
        mutationFn: async (sectionIds: string[]) => {
            // Update each section's order position
            await Promise.all(
                sectionIds.map((id, index) =>
                    supabase.functions.invoke("update-form-section", {
                        body: {
                            id,
                            order_position: index,
                        },
                    }),
                ),
            );
            return { sectionIds };
        },
        onMutate: async (sectionIds) => {
            const queryKey = getQueryKey();
            if (!queryKey) return;

            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData<MobileConfigData>(queryKey);

            queryClient.setQueryData<MobileConfigData>(queryKey, (old) => {
                if (!old) return old;
                const idToSection = new Map(old.sections.map((s) => [s.id, s]));
                const reordered = sectionIds
                    .map((id, index) => {
                        const section = idToSection.get(id);
                        return section ? { ...section, order_position: index } : undefined;
                    })
                    .filter((s): s is FormSectionWithFields => s !== undefined);
                return {
                    ...old,
                    sections: reordered,
                };
            });

            return { previousData };
        },
        onError: (err, _sectionIds, context) => {
            log.error("MobileConfig: Failed to reorder sections", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            const queryKey = getQueryKey();
            if (queryKey && context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
            onRefetch?.();
        },
        onSettled: () => {
            const queryKey = getQueryKey();
            if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
            }
        },
        onSuccess: () => {
            log.info("MobileConfig: Sections reordered successfully");
        },
    });

    // Handler functions
    const handleAdd = useCallback(
        (
            section: Omit<
                FormSectionWithFields,
                "id" | "organization_id" | "created_at" | "updated_at"
            >,
        ) => {
            if (!organizationId) return;
            createMutation.mutate({
                title: section.title,
                description: section.description ?? null,
                order_position: section.order_position,
                collapsed_by_default: section.collapsed_by_default,
                _tempId: `temp-section-${Date.now()}`,
            });
        },
        [organizationId, createMutation],
    );

    const handleUpdate = useCallback(
        (sectionId: string, updates: Partial<FormSectionWithFields>) => {
            updateMutation.mutate({ sectionId, updates });
        },
        [updateMutation],
    );

    const handleDelete = useCallback(
        (sectionId: string) => {
            deleteMutation.mutate(sectionId);
        },
        [deleteMutation],
    );

    const handleReorder = useCallback(
        (sectionIds: string[]) => {
            reorderMutation.mutate(sectionIds);
        },
        [reorderMutation],
    );

    // Use sections directly from props (which comes from React Query cache)
    // The optimistic updates are applied directly to the cache via onMutate
    const optimisticSections = useMemo(() => sections, [sections]);

    return {
        optimisticSections,
        handleAdd,
        handleUpdate,
        handleDelete,
        handleReorder,
    };
}
