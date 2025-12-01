export type ConditionalOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than";

export interface ConditionalRule {
  field_id: string; // The field to check
  operator: ConditionalOperator;
  value?: string | number | boolean | null; // The value to compare against
}

export interface ConditionalLogic {
  // Show this field when ALL conditions are met (AND logic)
  conditions: ConditionalRule[];
  // Optional: Use OR logic instead of AND
  match_type?: "all" | "any";
}
