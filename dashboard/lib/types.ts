// Dashboard-specific types only
// Shared types (FieldConfig, FieldType, ValidationRules) are imported from @/shared/types

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

export interface OrganizationSettings {
  use_predefined_locations: boolean;
}
