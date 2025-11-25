"use client";

import FieldConfigForm from "@/components/settings/field-config-form";
import FieldConfigList from "@/components/settings/field-config-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { FieldConfig, FieldType, ValidationRules } from "@/lib/types";
import { Plus } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";

type OptimisticAction<T> =
  | { type: "add"; item: T }
  | { type: "update"; item: T }
  | { type: "delete"; id: string }
  | { type: "reorder"; items: T[] };

function fieldConfigsReducer(
  state: FieldConfig[],
  action: OptimisticAction<FieldConfig>
): FieldConfig[] {
  switch (action.type) {
    case "add":
      return [...state, action.item];
    case "update":
      return state.map((fc) => (fc.id === action.item.id ? action.item : fc));
    case "delete":
      return state.filter((fc) => fc.id !== action.id);
    case "reorder":
      return action.items;
    default:
      return state;
  }
}

export default function MobileConfigPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();

  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [optimisticFieldConfigs, updateOptimisticFieldConfigs] = useOptimistic(
    fieldConfigs,
    fieldConfigsReducer
  );

  const fetchFieldConfigs = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError(null);
      log.debug("MobileConfig: Fetching field configs");

      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-field-configs",
        {
          body: { organization_id: organizationId },
        }
      );

      if (fetchError) {
        throw fetchError;
      }

      if (data?.field_configs) {
        log.info("MobileConfig: Field configs fetched successfully", {
          count: data.field_configs.length,
        });
        setFieldConfigs(data.field_configs);
      } else {
        setFieldConfigs([]);
      }
    } catch (err) {
      log.error("MobileConfig: Failed to fetch field configs", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(
        err instanceof Error ? err.message : "Failed to fetch field configs"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddFieldConfig = async (fieldConfigData: {
    name: string;
    label: string;
    field_type: FieldType;
    description: string | null;
    required: boolean;
    validation_rules: ValidationRules | null;
    options: string[] | null;
  }) => {
    if (!organizationId) return;

    // Optimistically add field config
    const optimisticFieldConfig: FieldConfig = {
      id: `temp-${Date.now()}`,
      organization_id: organizationId,
      ...fieldConfigData,
      order_position: fieldConfigs.length,
      version: 1,
      active: true,
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    startTransition(() => {
      updateOptimisticFieldConfigs({
        type: "add",
        item: optimisticFieldConfig,
      });
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, error: createError } = await supabase.functions.invoke(
        "create-field-config",
        {
          body: {
            ...fieldConfigData,
            organization_id: organizationId,
          },
        }
      );

      if (createError) {
        throw createError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Field config created successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to create field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  const handleUpdateFieldConfig = async (
    fieldConfigId: string,
    fieldConfigData: {
      name: string;
      label: string;
      field_type: FieldType;
      description: string | null;
      required: boolean;
      validation_rules: ValidationRules | null;
      options: string[] | null;
    }
  ) => {
    const existingFieldConfig = fieldConfigs.find(
      (fc) => fc.id === fieldConfigId
    );
    if (!existingFieldConfig) return;

    // Optimistically update field config
    const optimisticFieldConfig: FieldConfig = {
      ...existingFieldConfig,
      ...fieldConfigData,
      updated_at: new Date().toISOString(),
    };

    startTransition(() => {
      updateOptimisticFieldConfigs({
        type: "update",
        item: optimisticFieldConfig,
      });
    });

    try {
      const { error: updateError } = await supabase.functions.invoke(
        "update-field-config",
        {
          body: {
            id: fieldConfigId,
            ...fieldConfigData,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Field config updated successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to update field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  const handleDeleteFieldConfig = async (fieldConfigId: string) => {
    // Optimistically delete field config
    startTransition(() => {
      updateOptimisticFieldConfigs({ type: "delete", id: fieldConfigId });
    });

    try {
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-field-config",
        {
          body: { id: fieldConfigId },
        }
      );

      if (deleteError) {
        throw deleteError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Field config deleted successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to delete field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  const handleReorderFieldConfigs = async (fieldConfigIds: string[]) => {
    if (!organizationId) return;

    // Optimistically reorder
    const reorderedConfigs = fieldConfigIds
      .map((id) => fieldConfigs.find((fc) => fc.id === id))
      .filter((fc): fc is FieldConfig => fc !== undefined);

    startTransition(() => {
      updateOptimisticFieldConfigs({
        type: "reorder",
        items: reorderedConfigs,
      });
    });

    try {
      const { error: reorderError } = await supabase.functions.invoke(
        "reorder-field-configs",
        {
          body: {
            organization_id: organizationId,
            field_config_ids: fieldConfigIds,
          },
        }
      );

      if (reorderError) {
        throw reorderError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Field configs reordered successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to reorder field configs", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchFieldConfigs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading mobile config...</p>
        </div>
      </div>
    );
  }

  if (orgError || !organizationId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">
            {orgError || "Failed to load organization"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Mobile Config</h1>
        <p className="text-muted-foreground mt-2">
          Configure custom fields for the mobile app
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Field Configurations</CardTitle>
                <CardDescription>
                  Configure custom fields that will appear in the mobile app.
                  These fields can be used alongside predefined locations or as
                  standalone custom fields.
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <FieldConfigList
              fieldConfigs={optimisticFieldConfigs}
              loading={loading}
              error={error}
              onDeleteFieldConfig={handleDeleteFieldConfig}
              onUpdateFieldConfig={handleUpdateFieldConfig}
              onReorderFieldConfigs={handleReorderFieldConfigs}
            />
          </CardContent>
        </Card>
      </div>

      <FieldConfigForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={async (fieldConfigData) => {
          setIsFormOpen(false);
          await handleAddFieldConfig(fieldConfigData);
        }}
      />
    </>
  );
}
