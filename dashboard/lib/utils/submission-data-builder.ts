import type { FieldConfig } from "@clean-log/shared/types";

/**
 * Builds submission data from field values, handling different field types correctly
 * @param fields - Array of field configurations
 * @param fieldValues - Map of field IDs to their values
 * @returns Submission data object ready for API submission
 */
export function buildSubmissionData(
  fields: FieldConfig[],
  fieldValues: Record<string, unknown>,
): Record<string, unknown> {
  const submissionData: Record<string, unknown> = {};

  fields.forEach((field) => {
    const value = fieldValues[field.id];

    if (field.field_type === "grouped_breakdown") {
      // Ensure grouped_breakdown is always an array
      submissionData[field.name] = Array.isArray(value) ? value : [];
    } else if (field.field_type === "time") {
      // Ensure time is always a string in HH:mm format
      if (typeof value === "string" && value !== "") {
        submissionData[field.name] = value;
      } else {
        // If no value, use current time
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        submissionData[field.name] = `${hours}:${minutes}`;
      }
    } else if (
      field.field_type === "select" &&
      field.validation_rules?.allow_multiple === true
    ) {
      // Multi-select fields should be arrays
      submissionData[field.name] = Array.isArray(value) ? value : [];
    } else {
      // For other fields, use the value or empty string for non-required fields
      submissionData[field.name] = value ?? "";
    }
  });

  return submissionData;
}
