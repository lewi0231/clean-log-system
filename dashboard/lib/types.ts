export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  auth_user_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  email: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "select"
  | "textarea"
  | "date"
  | "time"
  | "boolean"
  | "grouped_breakdown";

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
  min_items?: number;
  max_items?: number;
  allow_zero_quantities?: boolean;
}

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

export interface OrganizationSettings {
  use_predefined_locations: boolean;
}
