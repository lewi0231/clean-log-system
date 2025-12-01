// Validation utilities for Edge Functions
// Provides common validation helpers

/**
 * Validate that all required fields are present in an object
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  data: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missingFields?: string[] } {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      missingFields.push(String(field));
    }
  }

  if (missingFields.length > 0) {
    return { valid: false, missingFields };
  }

  return { valid: true };
}

/**
 * Validate role value (admin or viewer)
 */
export function validateRole(role: string): boolean {
  return role === "admin" || role === "viewer";
}

/**
 * Validate business mode value
 */
export function validateBusinessMode(businessMode: string): boolean {
  return (
    businessMode === "service_based" || businessMode === "resource_tracking"
  );
}

/**
 * Validate that a value is a non-negative number
 */
export function validateNonNegativeNumber(value: unknown): value is number {
  return (
    typeof value === "number" && !isNaN(value) && value >= 0 && isFinite(value)
  );
}
