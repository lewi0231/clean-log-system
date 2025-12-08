"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { mobileConfigKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { FormSectionWithFields } from "@clean-log/shared";

interface MobileConfigData {
    fieldConfigs: unknown[];
    sections: FormSectionWithFields[];
}

interface UseSectionMutationsOptions {
    organizationId: string | null;
    sections: FormSectionWithFields[];
    onRefetch?: () => Promise<void>;
}

export function useSectionMutations({
    organizationId,
    sections,
    onRefetch,
}: UseSectionMutationsOptions) {
    const queryClient = useQueryClient();

    const invalidateCache = () => {
        if (organizationId) {
            queryClient.invalidateQueries({
                queryKey: mobileConfigKey(organizationId),
            });
        }
    };

    const createMutation = useMutation({
        mutationFn: async (section: {
            title: string;
            description: string | null;
            order_position: number;
            collapsed_by_default: boolean;
        }) => {
            if (!organizationId) {
                throw new Error("Organization ID is required");
            }
            const { error } = await supabase.functions.invoke(
                "create-form-section",
                {
                    body: {
                        organization_id: organizationId,
                        ...section,
                    },
                },
            );
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateCache();
        },
    });

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
        },
        onSuccess: () => {
            invalidateCache();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (sectionId: string) => {
            const { error } = await supabase.functions.invoke(
                "delete-form-section",
                {
                    body: { id: sectionId },
                },
            );
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateCache();
        },
    });

    const handleAdd = async (
        section: Omit<
            FormSectionWithFields,
            "id" | "organization_id" | "created_at" | "updated_at"
        >,
    ) => {
        if (!organizationId) return;

        // Optimistically add section
        const optimisticSection: FormSectionWithFields = {
            ...section,
            id: `temp-section-${Date.now()}`,
            organization_id: organizationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<MobileConfigData>(
            mobileConfigKey(organizationId),
            (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: [...old.sections, optimisticSection],
                };
            },
        );

        try {
            await createMutation.mutateAsync({
                title: section.title,
                description: section.description ?? null,
                order_position: section.order_position,
                collapsed_by_default: section.collapsed_by_default,
            });
            await onRefetch?.();
            log.info("MobileConfig: Section created successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to create section", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    const handleUpdate = async (
        sectionId: string,
        updates: Partial<FormSectionWithFields>,
    ) => {
        // Optimistically update section
        queryClient.setQueryData<MobileConfigData>(
            mobileConfigKey(organizationId),
            (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: old.sections.map((s) =>
                        s.id === sectionId
                            ? {
                                ...s,
                                ...updates,
                                updated_at: new Date().toISOString(),
                            }
                            : s
                    ),
                };
            },
        );

        try {
            await updateMutation.mutateAsync({ sectionId, updates });
            await onRefetch?.();
            log.info("MobileConfig: Section updated successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to update section", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    const handleDelete = async (sectionId: string) => {
        // Optimistically delete section
        queryClient.setQueryData<MobileConfigData>(
            mobileConfigKey(organizationId),
            (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: old.sections.filter((s) => s.id !== sectionId),
                };
            },
        );

        try {
            await deleteMutation.mutateAsync(sectionId);
            await onRefetch?.();
            log.info("MobileConfig: Section deleted successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to delete section", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    const handleReorder = async (sectionIds: string[]) => {
        // Optimistically reorder
        const reordered = sectionIds
            .map((id: string) =>
                sections.find((s: FormSectionWithFields) => s.id === id)
            )
            .filter((s): s is FormSectionWithFields => s !== undefined)
            .map((s: FormSectionWithFields, index: number) => ({
                ...s,
                order_position: index,
            }));

        queryClient.setQueryData<MobileConfigData>(
            mobileConfigKey(organizationId),
            (old) => {
                if (!old) return old;
                return {
                    ...old,
                    sections: reordered,
                };
            },
        );

        // Update each section's order_position in the database
        try {
            await Promise.all(
                reordered.map((section, index) =>
                    supabase.functions.invoke("update-form-section", {
                        body: {
                            id: section.id,
                            order_position: index,
                        },
                    })
                ),
            );
            await onRefetch?.();
            log.info("MobileConfig: Sections reordered successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to reorder sections", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
        }
    };

    return {
        handleAdd,
        handleUpdate,
        handleDelete,
        handleReorder,
    };
}
