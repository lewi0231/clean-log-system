import type { GroupedBreakdownItem } from "@/components/group-breakdown-field";
import { useMemo, useState } from "react";
import z from "zod";
import {
  FieldErrors,
  getFieldCluster,
  groupFieldsByMutualExclusivity,
  hasValue,
  useFieldConfigs,
} from "./use-field-configs";
import { useOrganizationSettings } from "./use-organization-settings";

interface UseEntryFormProps {
  organizationId: string | null;
  locationId?: string | null;
}

export function useEntryForm({ organizationId, locationId }: UseEntryFormProps) {
  const {
    fieldConfigs,
    fieldValues,
    sections,
    loading,
    resetFieldValues,
    updateFieldValue,
    FieldConfigSchema,
  } = useFieldConfigs(organizationId, locationId);
  const [errors, setErrors] = useState<FieldErrors>({});

  //   Fetch org settings
  const { settings } = useOrganizationSettings(organizationId || "");

  // Create extended schema that includes conditional validation based on settings
  // TODO - investigate later as this seems to be rendering way too often.
  const extendedSchema = useMemo(() => {
    if (!settings) return FieldConfigSchema;

    if (__DEV__) {
      console.debug("Entry: Settings:", settings);
    }

    const baseShape = FieldConfigSchema.shape;

    if (settings.use_predefined_locations) {
      return FieldConfigSchema.extend({
        location_id: z.string().min(1, "Location is required"),
      });
    }

    return FieldConfigSchema.extend({
      location_id: z.string().optional(),
    });
  }, [FieldConfigSchema, settings]);

  const buildSubmissionData = () => {
    const submissionData: Record<string, any> = {};
    fieldConfigs.forEach((config) => {
      const value = fieldValues[config.id];
      if (config.field_type === "grouped_breakdown") {
        // Ensure grouped_breakdown is always an array
        submissionData[config.name] = Array.isArray(value) ? value : [];
      } else if (config.field_type === "select" && config.validation_rules?.allow_multiple) {
        // Multi-select: ensure it's always an array
        submissionData[config.name] = Array.isArray(value) ? value : [];
      } else if (config.field_type === "time") {
        // Ensure time is always a string in HH:mm format
        if (typeof value === "string" && value !== "") {
          submissionData[config.name] = value;
        } else {
          // If no value, use current time
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, "0");
          const minutes = now.getMinutes().toString().padStart(2, "0");
          submissionData[config.name] = `${hours}:${minutes}`;
        }
      } else {
        submissionData[config.name] = value ?? (config.required ? null : "");
      }
    });

    return submissionData;
  };

  const validateMutuallyExclusiveGroups = (submissionData: Record<string, any>): FieldErrors => {
    const groups = groupFieldsByMutualExclusivity(fieldConfigs);
    const errors: FieldErrors = {};

    // Check each mutually exclusive group
    groups.forEach((configs, groupId) => {
      if (!groupId) return; // Skip ungrouped fields

      // Group fields by cluster
      const clusters = new Map<string | null, typeof configs>();
      configs.forEach((config) => {
        const cluster = getFieldCluster(config);
        if (!clusters.has(cluster)) {
          clusters.set(cluster, []);
        }
        clusters.get(cluster)!.push(config);
      });

      // Check which clusters have values
      const activeClusters: Array<{
        cluster: string | null;
        fields: typeof configs;
      }> = [];

      clusters.forEach((fields, cluster) => {
        const fieldsWithValues = fields.filter((fc) =>
          hasValue(submissionData[fc.name], fc.field_type, fc)
        );

        if (fieldsWithValues.length > 0) {
          activeClusters.push({ cluster, fields: fieldsWithValues });
        }
      });

      // Multiple clusters active = error
      if (activeClusters.length > 1) {
        activeClusters.forEach(({ fields }) => {
          fields.forEach((config) => {
            errors[config.id] = "Multiple tracking methods selected. Please use only one method.";
          });
        });
      }

      // Check required fields within active cluster
      if (activeClusters.length === 1) {
        const { fields: activeFields } = activeClusters[0];
        activeFields.forEach((config) => {
          if (
            config.required &&
            !hasValue(submissionData[config.name], config.field_type, config)
          ) {
            errors[config.id] = `${config.label} is required`;
          }
        });
      } else if (activeClusters.length === 0) {
        // Check if any field in group is required
        const requiredInGroup = configs.find((c) => c.required);
        if (requiredInGroup) {
          errors[requiredInGroup.id] = `Please select one tracking method: ${configs
            .map((c) => c.label)
            .join(", ")}`;
        }
      }
    });

    return errors;
  };

  const validateInputs = (submissionData: Record<string, any>) => {
    // First validate schema
    const validation = extendedSchema.safeParse(submissionData);

    if (!validation.success) {
      const fieldErrors: FieldErrors = {};

      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        // Map field name to field id for error storage
        const fieldConfig = fieldConfigs.find((fc) => fc.name === path);
        if (fieldConfig) {
          fieldErrors[fieldConfig.id] = issue.message;
        } else if (path === "location_id") {
          // Special handling for location_id - it's validated separately in the UI
          // We can skip schema errors for this as it's handled in handleNext
          // But if we want to show it, we'd need a special error key
          // For now, skip it since location validation is handled in the UI
        } else {
          if (__DEV__) {
            console.warn("Entry: validation error for unknown field:", path);
          }
        }
      });

      if (__DEV__) {
        console.warn("Entry: form validation failed", { errors: fieldErrors });
      }
      setErrors(fieldErrors);
      return false;
    }

    // Then validate mutually exclusive groups
    const groupErrors = validateMutuallyExclusiveGroups(submissionData);
    if (Object.keys(groupErrors).length > 0) {
      if (__DEV__) {
        console.warn("Entry: group validation failed", { errors: groupErrors });
      }
      setErrors(groupErrors);
      return false;
    }

    if (__DEV__) {
      console.warn("Entry: form validation success", validation.data);
    }
    setErrors({}); // Clear errors on success
    return true;
  };

  const resetForm = () => {
    const resetValues: Record<string, string | number | boolean | GroupedBreakdownItem[]> = {};
    fieldConfigs.forEach((config) => {
      if (config.field_type === "number") {
        resetValues[config.id] = 0;
      } else if (config.field_type === "boolean") {
        resetValues[config.id] = false;
      } else if (config.field_type === "grouped_breakdown") {
        resetValues[config.id] = [];
      } else if (config.field_type === "time") {
        // For time fields, reset to current time as HH:mm string
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        resetValues[config.id] = `${hours}:${minutes}`;
      } else {
        resetValues[config.id] = "";
      }
    });
    resetFieldValues(resetValues);
    setErrors({});
  };

  const clearFieldError = (fieldId: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
  };

  return {
    fieldConfigs,
    fieldValues,
    sections,
    loading,
    errors,
    updateFieldValue,
    buildSubmissionData,
    validateInputs,
    resetForm,
    clearFieldError,
  };
}
