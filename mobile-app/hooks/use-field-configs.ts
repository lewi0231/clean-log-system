import { GroupedBreakdownItem } from "@/components/group-breakdown-field";
import { supabase } from "@/lib/supabase";
import { createSchemaFromFieldConfig } from "@/lib/utils";
import { FieldConfig } from "@/shared/types/field-config";
import { FieldType } from "@/shared/types/field-type";
import { useEffect, useState } from "react";

export type FieldErrors = Partial<Record<FieldConfig["name"], string>>;

// Helper: Get cluster identifier for a field
export function getFieldCluster(fieldConfig: FieldConfig): string | null {
  return fieldConfig.group_cluster || null;
}

// Helper: Check if two fields are in the same cluster
export function areInSameCluster(
  field1: FieldConfig,
  field2: FieldConfig
): boolean {
  const cluster1 = getFieldCluster(field1);
  const cluster2 = getFieldCluster(field2);
  return cluster1 !== null && cluster1 === cluster2;
}

// Helper: Group fields by mutually_exclusive_group
export function groupFieldsByMutualExclusivity(
  fieldConfigs: FieldConfig[]
): Map<string | null, FieldConfig[]> {
  const groups = new Map<string | null, FieldConfig[]>();

  fieldConfigs.forEach((config) => {
    const groupKey = config.mutually_exclusive_group || null;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(config);
  });

  return groups;
}

// Helper: Check if a field has a non-empty value
export function hasValue(value: unknown, fieldType: FieldType): boolean {
  if (value === null || value === undefined) return false;

  switch (fieldType) {
    case "boolean":
      return value === true;
    case "number":
      return typeof value === "number" && value > 0;
    case "grouped_breakdown":
      return Array.isArray(value) && value.length > 0;
    case "text":
    case "textarea":
    case "email":
    case "phone":
      return typeof value === "string" && value.trim().length > 0;
    case "date":
      return typeof value === "string" && value.length > 0;
    case "time":
      return typeof value === "string" && value.length > 0;
    case "select":
      return typeof value === "string" && value.length > 0;
    default:
      return false;
  }
}

// Helper: Check if a field should be disabled based on other active clusters
export function isFieldDisabled(
  fieldConfig: FieldConfig,
  fieldConfigs: FieldConfig[],
  fieldValues: Record<string, unknown>
): boolean {
  const groupId = fieldConfig.mutually_exclusive_group;
  if (!groupId) return false; // No group = never disabled

  const fieldCluster = getFieldCluster(fieldConfig);

  // Find all fields in the same group
  const groupFields = fieldConfigs.filter(
    (fc) => fc.mutually_exclusive_group === groupId
  );

  // Find which clusters/fields currently have values
  const activeClusters = new Set<string | null>();

  groupFields.forEach((otherField) => {
    if (
      otherField.id !== fieldConfig.id &&
      hasValue(fieldValues[otherField.id], otherField.field_type)
    ) {
      const otherCluster = getFieldCluster(otherField);
      activeClusters.add(otherCluster);
    }
  });

  // If another cluster is active, disable this field
  // UNLESS this field is in the same cluster as an active one
  if (activeClusters.size > 0) {
    // Check if this field's cluster is already active
    if (fieldCluster !== null && activeClusters.has(fieldCluster)) {
      // Same cluster is active - allow it
      return false;
    }

    // Different cluster is active - disable this field
    return true;
  }

  return false; // No active clusters - field is enabled
}

export function useFieldConfigs(organizationId: string | null) {
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  // Dynamic field values: key is field config id, value is the field value
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | number | boolean | GroupedBreakdownItem[]>
  >({});

  const resetFieldValues = (
    values: Record<string, string | number | boolean | GroupedBreakdownItem[]>
  ) => {
    setFieldValues(values);
  };

  const updateFieldValue = (
    fieldId: string,
    value: string | number | boolean | GroupedBreakdownItem[]
  ) => {
    setFieldValues((prev) => {
      const currentField = fieldConfigs.find((fc) => fc.id === fieldId);
      if (!currentField) {
        return { ...prev, [fieldId]: value };
      }

      const groupId = currentField.mutually_exclusive_group;
      const currentCluster = getFieldCluster(currentField);
      const hasNonEmptyValue = hasValue(value, currentField.field_type);

      // If this field now has a value and is in a group, clear conflicting values
      if (hasNonEmptyValue && groupId) {
        const groupFields = fieldConfigs.filter(
          (fc) => fc.mutually_exclusive_group === groupId
        );

        // Find fields in OTHER clusters that have values
        const otherClusterFields = groupFields.filter((fc) => {
          const fcCluster = getFieldCluster(fc);
          return (
            fc.id !== fieldId &&
            fcCluster !== currentCluster &&
            hasValue(prev[fc.id], fc.field_type)
          );
        });

        // Clear values from other clusters
        const clearedValues: Record<string, unknown> = {};
        otherClusterFields.forEach((fc) => {
          switch (fc.field_type) {
            case "boolean":
              clearedValues[fc.id] = false;
              break;
            case "number":
              clearedValues[fc.id] = 0;
              break;
            case "grouped_breakdown":
              clearedValues[fc.id] = [];
              break;
            case "time":
              // Reset to current time
              const now = new Date();
              const hours = now.getHours().toString().padStart(2, "0");
              const minutes = now.getMinutes().toString().padStart(2, "0");
              clearedValues[fc.id] = `${hours}:${minutes}`;
              break;
            default:
              clearedValues[fc.id] = "";
          }
        });

        return {
          ...prev,
          [fieldId]: value,
          ...clearedValues,
        };
      }

      return {
        ...prev,
        [fieldId]: value,
      };
    });
  };

  useEffect(() => {
    if (!organizationId) return;

    async function fetchFieldConfigs() {
      try {
        console.log("📋 Field Configs: Fetching for organization", {
          organizationId,
        });

        const { data, error } = await supabase.functions.invoke(
          "list-field-configs",
          {
            body: { organization_id: organizationId },
          }
        );

        if (error) {
          console.error("📋 Field Configs: Error", error);
          return;
        }

        console.log("📋 Field Configs: Response received", {
          success: data?.success,
          fieldConfigs: data?.field_configs,
        });

        if (data?.field_configs) {
          setFieldConfigs(data.field_configs);
          // Initialize field values with default values
          const initialValues: Record<
            string,
            string | number | boolean | GroupedBreakdownItem[]
          > = {};
          data.field_configs.forEach((config: FieldConfig) => {
            if (config.field_type === "number") {
              initialValues[config.id] = 0;
            } else if (config.field_type === "boolean") {
              initialValues[config.id] = false;
            } else if (config.field_type === "grouped_breakdown") {
              initialValues[config.id] = [];
            } else if (config.field_type === "time") {
              // Initialize time fields with current time as HH:mm string
              const now = new Date();
              const hours = now.getHours().toString().padStart(2, "0");
              const minutes = now.getMinutes().toString().padStart(2, "0");
              initialValues[config.id] = `${hours}:${minutes}`;
            } else {
              initialValues[config.id] = "";
            }
          });
          setFieldValues(initialValues);
        }
      } catch (err) {
        console.error("📋 Field Configs: Failed to fetch", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    fetchFieldConfigs();
  }, [organizationId]);

  return {
    fieldValues,
    fieldConfigs,
    resetFieldValues,
    updateFieldValue,
    FieldConfigSchema: createSchemaFromFieldConfig(fieldConfigs),
  };
}
