"use client";

import FieldConfigForm from "@/components/settings/field-config-form";
import FieldConfigList from "@/components/settings/field-config-list";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useModeAwareLabels } from "@/hooks/use-mode-aware-labels";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { getTemplateDescription, getTemplateFields } from "@/lib/templates";
import { FieldConfig, FieldType, ValidationRules } from "@/shared/types";
import { Package, Plus, RotateCcw, Sparkles } from "lucide-react";
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
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const labels = useModeAwareLabels();

  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
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
    mutually_exclusive_group: string | null;
    group_cluster: string | null;
  }) => {
    if (!organizationId) return;

    // Optimistically add field config
    const optimisticFieldConfig: FieldConfig = {
      id: `temp-${Date.now()}`,
      organization_id: organizationId,
      ...fieldConfigData,
      mutually_exclusive_group:
        fieldConfigData.mutually_exclusive_group || null,
      group_cluster: fieldConfigData.group_cluster || null,
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
      mutually_exclusive_group: string | null;
      group_cluster: string | null;
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
      mutually_exclusive_group:
        fieldConfigData.mutually_exclusive_group ??
        existingFieldConfig.mutually_exclusive_group,
      group_cluster:
        fieldConfigData.group_cluster ?? existingFieldConfig.group_cluster,
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

  const [resetTemplateMode, setResetTemplateMode] = useState<
    "service_based" | "resource_tracking" | null
  >(null);

  const handleApplyTemplate = async (
    businessMode: "service_based" | "resource_tracking",
    resetExisting = false
  ) => {
    if (!organizationId) return;

    try {
      setApplyingTemplate(true);
      log.info("MobileConfig: Applying template", {
        businessMode,
        resetExisting,
      });

      const { data, error: templateError } = await supabase.functions.invoke(
        "apply-field-config-template",
        {
          body: {
            organization_id: organizationId,
            business_mode: businessMode,
            reset_existing: resetExisting,
          },
        }
      );

      if (templateError) {
        throw templateError;
      }

      if (data?.success) {
        await fetchFieldConfigs();
        setResetTemplateMode(null);
        log.info("MobileConfig: Template applied successfully", {
          count: data.count,
          resetExisting,
        });
      }
    } catch (err) {
      log.error("MobileConfig: Failed to apply template", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(err instanceof Error ? err.message : "Failed to apply template");
    } finally {
      setApplyingTemplate(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchFieldConfigs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            Loading mobile application configuration...
          </p>
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
      <div className="mb-8 w-3/4">
        <h1 className="text-3xl font-bold tracking-tight">
          Mobile Application
        </h1>
        <p className="text-muted-foreground mt-2">
          {labels.mobileConfigDescription}
        </p>
      </div>

      <div className="space-y-6">
        {/* Show template options when no field configs exist */}
        {fieldConfigs.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Get Started with a Template</CardTitle>
              <CardDescription>
                Start with a pre-configured set of fields tailored to your
                business mode, or build from scratch.
                {settings?.business_mode && (
                  <span className="block mt-2 text-sm font-medium">
                    Recommended:{" "}
                    {settings.business_mode === "service_based"
                      ? "Service-Based Template"
                      : "Resource Tracking Template"}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <button
                    onClick={() => handleApplyTemplate("service_based")}
                    disabled={applyingTemplate}
                    className={`w-full flex flex-col rounded-lg border-2 p-6 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                      settings?.business_mode === "service_based"
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">
                          Service-Based Template
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Car Detailer
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {getTemplateDescription("service_based")}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Includes:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {getTemplateFields("service_based").map((field) => (
                          <li key={field.name}>{field.label}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => handleApplyTemplate("resource_tracking")}
                    disabled={applyingTemplate}
                    className={`w-full flex flex-col rounded-lg border-2 p-6 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                      settings?.business_mode === "resource_tracking"
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">
                          Resource Tracking Template
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Car Yard Business
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {getTemplateDescription("resource_tracking")}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Includes:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {getTemplateFields("resource_tracking").map((field) => (
                          <li key={field.name}>{field.label}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsFormOpen(true)}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Build from Scratch
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show field configurations when they exist */}
        {fieldConfigs.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Field Configurations</CardTitle>
                    <CardDescription className="w-3/4 pt-2">
                      Configure custom fields that will appear in the mobile
                      app. These fields can be used alongside predefined
                      locations or as standalone custom fields.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsFormOpen(true)}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (settings?.business_mode) {
                          setResetTemplateMode(settings.business_mode);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset to Template
                    </Button>
                  </div>
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

            {/* Reset Template Dialog */}
            <AlertDialog
              open={resetTemplateMode !== null}
              onOpenChange={(open) => {
                if (!open) setResetTemplateMode(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset to Template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will replace all your current field configurations with
                    the template fields. This action cannot be undone. Your
                    existing fields will be archived.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      onClick={() => {
                        if (resetTemplateMode) {
                          handleApplyTemplate("service_based", true);
                        }
                      }}
                      disabled={applyingTemplate}
                      className={`flex flex-col rounded-lg border-2 p-4 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                        resetTemplateMode === "service_based"
                          ? "border-primary bg-primary/5"
                          : "border-muted bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <div className="font-semibold text-sm">
                          Service-Based Template
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getTemplateDescription("service_based")}
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        if (resetTemplateMode) {
                          handleApplyTemplate("resource_tracking", true);
                        }
                      }}
                      disabled={applyingTemplate}
                      className={`flex flex-col rounded-lg border-2 p-4 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                        resetTemplateMode === "resource_tracking"
                          ? "border-primary bg-primary/5"
                          : "border-muted bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-primary" />
                        <div className="font-semibold text-sm">
                          Resource Tracking Template
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getTemplateDescription("resource_tracking")}
                      </p>
                    </button>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
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
