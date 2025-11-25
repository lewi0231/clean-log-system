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
  version: number;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
