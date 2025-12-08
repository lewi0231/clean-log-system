"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startTransition, useOptimistic } from "react";

import { mobileConfigKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
    ConditionalLogic,
    FieldConfig,
    FieldType,
    ValidationRules,
} from "@clean-log/shared";

type OptimisticAction<T> =
    | { type: "add"; item: T }
    | { type: "update"; item: T }
    | { type: "delete"; id: string }
    | { type: "reorder"; items: T[] };

function fieldConfigsReducer(
    state: FieldConfig[],
    action: OptimisticAction<FieldConfig>,
): FieldConfig[] {
    switch (action.type) {
        case "add":
            return [...state, action.item];
        case "update":
            return state.map((
                fc,
            ) => (fc.id === action.item.id ? action.item : fc));
        case "delete":
            return state.filter((fc) => fc.id !== action.id);
        case "reorder":
            return action.items;
        default:
            return state;
    }
}

interface UseFieldConfigMutationsOptions {
    organizationId: string | null;
    fieldConfigs: FieldConfig[];
    onRefetch?: () => Promise<void>;
}

export function useFieldConfigMutations({
    organizationId,
    fieldConfigs,
    onRefetch,
}: UseFieldConfigMutationsOptions) {
    const queryClient = useQueryClient();

    const [optimisticFieldConfigs, updateOptimisticFieldConfigs] =
        useOptimistic(
            fieldConfigs,
            fieldConfigsReducer,
        );

    const invalidateCache = () => {
        if (organizationId) {
            queryClient.invalidateQueries({
                queryKey: mobileConfigKey(organizationId),
            });
        }
    };

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
        }) => {
            if (!organizationId) {
                throw new Error("Organization ID is required");
            }
            const { error } = await supabase.functions.invoke(
                "create-field-config",
                {
                    body: {
                        ...fieldConfigData,
                        organization_id: organizationId,
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
            fieldConfigId,
            fieldConfigData,
        }: {
            fieldConfigId: string;
            fieldConfigData: Partial<FieldConfig>;
        }) => {
            const { error } = await supabase.functions.invoke(
                "update-field-config",
                {
                    body: {
                        id: fieldConfigId,
                        ...fieldConfigData,
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
        mutationFn: async (fieldConfigId: string) => {
            const { error } = await supabase.functions.invoke(
                "delete-field-config",
                {
                    body: { id: fieldConfigId },
                },
            );
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateCache();
        },
    });

    const reorderMutation = useMutation({
        mutationFn: async (fieldConfigIds: string[]) => {
            if (!organizationId) {
                throw new Error("Organization ID is required");
            }
            const { error } = await supabase.functions.invoke(
                "reorder-field-configs",
                {
                    body: {
                        organization_id: organizationId,
                        field_config_ids: fieldConfigIds,
                    },
                },
            );
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateCache();
        },
    });

    const handleAdd = async (fieldConfigData: {
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

        // Optimistically add field config
        const optimisticFieldConfig: FieldConfig = {
            id: `temp-${Date.now()}`,
            organization_id: organizationId,
            ...fieldConfigData,
            version: 1,
            active: true,
            archived_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        // Call optimistic update in a transition (required by React 19)
        startTransition(() => {
            updateOptimisticFieldConfigs({
                type: "add",
                item: optimisticFieldConfig,
            });
        });

        try {
            // Execute async mutation (startTransition doesn't need to wrap it for our use case)
            await createMutation.mutateAsync(fieldConfigData);
            await onRefetch?.();
            log.info("MobileConfig: Field config created successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to create field config", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    const handleUpdate = async (
        fieldConfigId: string,
        fieldConfigData: Partial<FieldConfig>,
    ) => {
        const existingFieldConfig = optimisticFieldConfigs.find(
            (fc) => fc.id === fieldConfigId,
        );
        if (!existingFieldConfig) return;

        // Optimistically update field config
        const optimisticFieldConfig: FieldConfig = {
            ...existingFieldConfig,
            ...fieldConfigData,
            updated_at: new Date().toISOString(),
        };

        // Call optimistic update in a transition (required by React 19)
        startTransition(() => {
            updateOptimisticFieldConfigs({
                type: "update",
                item: optimisticFieldConfig,
            });
        });

        try {
            // Execute async mutation
            await updateMutation.mutateAsync({
                fieldConfigId,
                fieldConfigData,
            });
            log.info("MobileConfig: Field config updated successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to update field config", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    const handleDelete = async (fieldConfigId: string) => {
        // Optimistically delete field config - call in a transition (required by React 19)
        startTransition(() => {
            updateOptimisticFieldConfigs({ type: "delete", id: fieldConfigId });
        });

        try {
            // Execute async mutation
            await deleteMutation.mutateAsync(fieldConfigId);
            await onRefetch?.();
            log.info("MobileConfig: Field config deleted successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to delete field config", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    const handleReorder = async (fieldConfigIds: string[]) => {
        if (!organizationId) return;

        // Optimistically reorder - use current optimistic state
        const reorderedConfigs = fieldConfigIds
            .map((id) => optimisticFieldConfigs.find((fc) => fc.id === id))
            .filter((fc): fc is FieldConfig => fc !== undefined);

        // Call optimistic update in a transition (required by React 19)
        startTransition(() => {
            updateOptimisticFieldConfigs({
                type: "reorder",
                items: reorderedConfigs,
            });
        });

        try {
            // Execute async mutation
            await reorderMutation.mutateAsync(fieldConfigIds);
            log.info("MobileConfig: Field configs reordered successfully");
        } catch (err) {
            log.error("MobileConfig: Failed to reorder field configs", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            await onRefetch?.();
            throw err;
        }
    };

    return {
        optimisticFieldConfigs,
        handleAdd,
        handleUpdate,
        handleDelete,
        handleReorder,
    };
}
