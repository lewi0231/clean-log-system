import { GroupedBreakdownItem } from "@/components/group-breakdown-field";
import { supabase } from "@/lib/supabase";
import { FieldConfig } from "@/types/field-config";
import { useEffect, useState } from "react";

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
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
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

  return { fieldValues, fieldConfigs, resetFieldValues, updateFieldValue };
}
