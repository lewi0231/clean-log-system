"use client";

// 1. React
import { useEffect, useOptimistic, useState, useTransition } from "react";

// 2. Third-party
import { Package, RotateCcw, Sparkles } from "lucide-react";

// 3. Internal components
import { VisualFormBuilder } from "@/components/form-builder";
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

// 4. Hooks
import { useModeAwareLabels } from "@/hooks/use-mode-aware-labels";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";

// 5. Services/Utils
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { getTemplateDescription, getTemplateFields } from "@/lib/templates";

// 6. Shared types
import {
  ConditionalLogic,
  FieldConfig,
  FieldType,
  FormSectionWithFields,
  ValidationRules,
} from "@clean-log/shared";

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
  const [sections, setSections] = useState<FormSectionWithFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
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
      if (fieldConfigsResponse.data?.field_configs) {
        log.info("MobileConfig: Field configs fetched successfully", {
          count: fieldConfigsResponse.data.field_configs.length,
        });
        const configsWithDefaults = fieldConfigsResponse.data.field_configs.map(
          (fc: FieldConfig) => ({
            ...fc,
            section_id: fc.section_id ?? null,
            conditional_logic: fc.conditional_logic ?? null,
          })
        );
        setFieldConfigs(configsWithDefaults);
      } else {
        setFieldConfigs([]);
      }

      // Process sections
      if (sectionsResponse.data?.sections) {
        log.info("MobileConfig: Sections fetched successfully", {
          count: sectionsResponse.data.sections.length,
        });
        // Convert to FormSectionWithFields by adding field_ids
        const sectionsWithFields: FormSectionWithFields[] =
          sectionsResponse.data.sections.map(
            (section: FormSectionWithFields) => ({
              ...section,
              field_ids:
                fieldConfigsResponse.data?.field_configs
                  ?.filter((fc: FieldConfig) => fc.section_id === section.id)
                  .map((fc: FieldConfig) => fc.id) || [],
            })
          );
        setSections(sectionsWithFields);
      } else {
        setSections([]);
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

    startTransition(() => {
      updateOptimisticFieldConfigs({
        type: "add",
        item: optimisticFieldConfig,
      });
    });

    try {
      const { error: createError } = await supabase.functions.invoke(
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
    fieldConfigData: Partial<FieldConfig>
  ) => {
    const existingFieldConfig = optimisticFieldConfigs.find(
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
      setFieldConfigs((prev) =>
        prev.map((fc) => (fc.id === fieldConfigId ? optimisticFieldConfig : fc))
      );
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

      log.info("MobileConfig: Field config updated successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to update field config", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      // Rollback to server state on error
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
      .map((id) => optimisticFieldConfigs.find((fc) => fc.id === id))
      .filter((fc): fc is FieldConfig => fc !== undefined);

    startTransition(() => {
      updateOptimisticFieldConfigs({
        type: "reorder",
        items: reorderedConfigs,
      });
      setFieldConfigs(reorderedConfigs);
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

      log.info("MobileConfig: Field configs reordered successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to reorder field configs", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      // Rollback to server state on error
      await fetchFieldConfigs();
      throw err;
    }
  };

  // Section handlers - persist to database
  const handleAddSection = async (
    section: Omit<
      FormSectionWithFields,
      "id" | "organization_id" | "created_at" | "updated_at"
    >
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
    setSections((prev) => [...prev, optimisticSection]);

    try {
      const { error: createError } = await supabase.functions.invoke(
        "create-form-section",
        {
          body: {
            organization_id: organizationId,
            title: section.title,
            description: section.description,
            order_position: section.order_position,
            collapsed_by_default: section.collapsed_by_default,
          },
        }
      );

      if (createError) {
        throw createError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Section created successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to create section", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  const handleUpdateSection = async (
    sectionId: string,
    updates: Partial<FormSectionWithFields>
  ) => {
    // Optimistically update section
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, ...updates, updated_at: new Date().toISOString() }
          : s
      )
    );

    try {
      const { error: updateError } = await supabase.functions.invoke(
        "update-form-section",
        {
          body: {
            id: sectionId,
            ...updates,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Section updated successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to update section", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    // Optimistically delete section
    setSections((prev) => prev.filter((s) => s.id !== sectionId));

    try {
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-form-section",
        {
          body: { id: sectionId },
        }
      );

      if (deleteError) {
        throw deleteError;
      }

      await fetchFieldConfigs();
      log.info("MobileConfig: Section deleted successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to delete section", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
      throw err;
    }
  };

  const handleReorderSections = async (sectionIds: string[]) => {
    // Optimistically reorder
    const reordered = sectionIds
      .map((id) => sections.find((s) => s.id === id))
      .filter((s): s is FormSectionWithFields => s !== undefined)
      .map((s, index) => ({ ...s, order_position: index }));
    setSections(reordered);

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
        )
      );
      log.info("MobileConfig: Sections reordered successfully");
    } catch (err) {
      log.error("MobileConfig: Failed to reorder sections", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchFieldConfigs();
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

  // Update section field_ids when field configs change
  useEffect(() => {
    if (sections.length > 0 && fieldConfigs.length > 0) {
      setSections((prevSections) =>
        prevSections.map((section) => ({
          ...section,
          field_ids: fieldConfigs
            .filter((fc) => fc.section_id === section.id)
            .map((fc) => fc.id),
        }))
      );
    }
  }, [fieldConfigs, sections.length]);

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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="w-3/4">
            <h1 className="text-3xl font-bold tracking-tight">
              Mobile Application
            </h1>
            <p className="text-muted-foreground mt-2">
              {labels.mobileConfigDescription}
            </p>
          </div>
          {fieldConfigs.length > 0 && (
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
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Show template options when no field configs exist */}
        {fieldConfigs.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Get Started with a Template</CardTitle>
              <CardDescription>
                Start with a pre-configured set of fields tailored to your
                business mode, or build from scratch with the visual form
                builder.
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
            </CardContent>
          </Card>
        )}

        {/* Show Visual Form Builder when fields exist */}
        {(fieldConfigs.length > 0 || loading) && (
          <VisualFormBuilder
            fields={optimisticFieldConfigs}
            sections={sections}
            onAddField={handleAddFieldConfig}
            onUpdateField={handleUpdateFieldConfig}
            onDeleteField={handleDeleteFieldConfig}
            onReorderFields={handleReorderFieldConfigs}
            onAddSection={handleAddSection}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onReorderSections={handleReorderSections}
          />
        )}
      </div>

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
              This will replace all your current field configurations with the
              template fields. This action cannot be undone. Your existing
              fields will be archived.
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
  );
}
