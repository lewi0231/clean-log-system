// Dashboard-specific types only
// Shared types (FieldConfig, FieldType, ValidationRules) are imported from @/shared/types

export type ChartType = "area" | "line" | "pie" | "bar";

export type GroupingDimension = "time" | "worker" | "location" | "field";

export type TimePeriod = "day" | "week" | "month" | "year";

export type GroupedBreakdownMode = "brand" | "quantity";

export interface ChartConfig {
  chartType: ChartType;
  fieldConfigId: string | null;
  groupingDimension: GroupingDimension;
  groupingFieldConfigId?: string | null; // For "field" dimension
  timePeriod?: TimePeriod; // For "time" dimension
  groupedBreakdownMode?: GroupedBreakdownMode; // For grouped_breakdown fields
  dateRange?: {
    start: Date;
    end: Date;
  };
  aggregationType?: "sum" | "average" | "count"; // For numeric fields
}

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

export interface Job {
  id: string;
  organization_id: string;
  location_id: string | null;
  submission_data: Record<string, unknown> | null;
  completed_at: string;
  created_at: string;
  location: {
    id: string;
    name: string;
    email: string;
    address: string | null;
    contact_person: string | null;
    phone: string | null;
  } | null;
  workers: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
  }>;
}

export interface FieldPricing {
  id: string;
  organization_id: string;
  field_config_id: string;
  unit_price: number;
  currency: string;
  created_at: string;
  updated_at: string;
  field_config?: {
    id: string;
    name: string;
    label: string;
    field_type: string;
  };
}
