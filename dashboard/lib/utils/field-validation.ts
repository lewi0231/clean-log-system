import type { FieldConfig } from "@clean-log/shared/types";

/**
 * Validates a field value based on its configuration
 * @param field - The field configuration
 * @param value - The field value to validate
 * @returns Error message if invalid, null if valid
 */
export function validateFieldValue(
  field: FieldConfig,
  value: unknown,
): string | null {
  if (!field.required) {
    // Non-required fields are always valid (can be empty)
    return null;
  }

  // For boolean fields, false is a valid value (only undefined/null is invalid)
  if (field.field_type === "boolean") {
    if (value === undefined || value === null) {
      return `${field.label} is required`;
    }
    return null;
  }

  // For multi-select fields, check if array has at least one item
  if (
    field.field_type === "select" &&
    field.validation_rules?.allow_multiple === true
  ) {
    if (!Array.isArray(value) || value.length === 0) {
      return `${field.label} is required`;
    }
    return null;
  }

  // For single-select fields, check if value is provided
  if (field.field_type === "select") {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return `${field.label} is required`;
    }
    return null;
  }

  // For grouped_breakdown fields, check if array has at least one item
  if (field.field_type === "grouped_breakdown") {
    if (!Array.isArray(value) || value.length === 0) {
      return `${field.label} is required`;
    }
    return null;
  }

  // For text-based fields, check if value is not empty
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return `${field.label} is required`;
  }

  return null;
}

/**
 * Validates multiple fields and returns a map of field IDs to error messages
 * @param fields - Array of field configurations to validate
 * @param fieldValues - Map of field IDs to their values
 * @returns Map of field ID to error message (only includes fields with errors)
 */
export function validateFields(
  fields: FieldConfig[],
  fieldValues: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    const value = fieldValues[field.id];
    const error = validateFieldValue(field, value);
    if (error) {
      errors[field.id] = error;
    }
  });

  return errors;
}
