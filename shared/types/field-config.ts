import { ConditionalLogic } from "./conditional-logic";
import { FieldType } from "./field-type";
import { ValidationRules } from "./validation-rule";

export interface FieldConfig {
  id: string;
  organization_id: string;
  name: string;
  label: string;
  field_type: FieldType;
  description: string | null;
  required: boolean;
  order_position: number;
  validation_rules: ValidationRules | null;
  options: string[] | null; // For select fields
  mutually_exclusive_group: string | null;
  group_cluster: string | null;
  // New: Section grouping
  section_id: string | null;
  // New: Conditional visibility
  conditional_logic: ConditionalLogic | null;
  version: number;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
