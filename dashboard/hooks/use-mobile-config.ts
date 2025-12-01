"use client";

// 1. React
import { useEffect, useOptimistic, useState, useTransition } from "react";

// 5. Services/Utils
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

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
    fieldConfigData: Partial<FieldConfig>
  ) => Promise<void>;
  handleDeleteFieldConfig: (fieldConfigId: string) => Promise<void>;
  handleReorderFieldConfigs: (fieldConfigIds: string[]) => Promise<void>;
  handleAddSection: (
    section: Omit<
      FormSectionWithFields,
      "id" | "organization_id" | "created_at" | "updated_at"
    >
  ) => Promise<void>;
  handleUpdateSection: (
    sectionId: string,
    updates: Partial<FormSectionWithFields>
  ) => Promise<void>;
  handleDeleteSection: (sectionId: string) => Promise<void>;
  handleReorderSections: (sectionIds: string[]) => Promise<void>;
  handleApplyTemplate: (
    businessMode: "service_based" | "resource_tracking",
    resetExisting?: boolean
  ) => Promise<void>;
}

export function useMobileConfig(
  organizationId: string | null
): UseMobileConfigResult {
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [sections, setSections] = useState<FormSectionWithFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    } else {
      setLoading(false);
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

  return {
    fieldConfigs,
    optimisticFieldConfigs,
    sections,
    loading,
    error,
    applyingTemplate,
    fetchFieldConfigs,
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
