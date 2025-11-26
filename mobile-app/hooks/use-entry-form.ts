import { GroupedBreakdownItem } from "@/components/group-breakdown-field";
import { useMemo, useState } from "react";
import z from "zod";
import { FieldErrors, useFieldConfigs } from "./use-field-configs";
import { useOrganizationSettings } from "./use-organization-settings";

interface UseEntryFormProps {
  organizationId: string | null;
}

export function useEntryForm({ organizationId }: UseEntryFormProps) {
  const {
    fieldConfigs,
    fieldValues,
    resetFieldValues,
    updateFieldValue,
    FieldConfigSchema,
  } = useFieldConfigs(organizationId);
  const [errors, setErrors] = useState<FieldErrors>({});

  //   Fetch org settings
  const { settings } = useOrganizationSettings(organizationId || "");

  // Create extended schema that includes conditional validation based on settings
  const extendedSchema = useMemo(() => {
    if (!settings) return FieldConfigSchema;

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

  const validateInputs = (submissionData: Record<string, any>) => {
    const validation = extendedSchema.safeParse(submissionData);

    if (!validation.success) {
      const fieldErrors: FieldErrors = {};

      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      });

      console.warn("Entry: form validation failed", { errors: fieldErrors });
      setErrors(fieldErrors);
      return false;
    }
    console.warn("Entry: form validation success", validation.data);
    setErrors({}); // Clear errors on success
    return true;
  };

  const resetForm = () => {
    const resetValues: Record<
      string,
      string | number | boolean | GroupedBreakdownItem[]
    > = {};
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

  const clearFieldError = (fieldName: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  return {
    fieldConfigs,
    fieldValues,
    errors,
    updateFieldValue,
    buildSubmissionData,
    validateInputs,
    resetForm,
    clearFieldError,
  };
}
