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

export interface OrganizationUser {
  id: string;
  organization_id: string;
  email: string;
  role: "admin" | "viewer";
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

export type BusinessMode = "service_based" | "resource_tracking";

export interface OrganizationSettings {
  name: string;
  use_predefined_locations: boolean;
  business_mode: BusinessMode;
  abn: string | null;
  logo_url: string | null;
  primary_contact_email: string | null;
  invoice_send_immediately: boolean;
  stripe_account_id: string | null;
  payment_provider: string | null;
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

export type PricingType = "unit" | "fixed";
export type WorkerPaymentType = "same_structure" | "percentage" | "fixed_rate";

export interface OptionPricing {
  id: string;
  organization_id: string;
  field_config_id: string;
  option_value: string;
  customer_price: number;
  worker_payment_rate: number | null;
  location_id: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  field_config?: {
    id: string;
    name: string;
    label: string;
    field_type: string;
  };
  location?: {
    id: string;
    name: string;
  } | null;
}

export interface BasePricing {
  id: string;
  organization_id: string;
  job_type_field_config_id: string | null;
  job_type_value: string | null;
  standalone_base_price: number | null;
  customer_base_price: number;
  worker_base_payment: number | null;
  adjustment_type: "add" | "multiply";
  location_id: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  field_config?: {
    id: string;
    name: string;
    label: string;
    field_type: string;
  } | null;
  location?: {
    id: string;
    name: string;
  } | null;
}

export type PricingRuleType = "discount" | "surcharge" | "override";
export type ConditionOperator =
  | "equals"
  | "greater_than"
  | "less_than"
  | "contains"
  | "not_equals";
export type ActionType = "multiply" | "add" | "set";

export interface PricingRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  rule_type: PricingRuleType;
  condition_field_config_id: string;
  condition_operator: ConditionOperator;
  condition_value: string;
  action_type: ActionType;
  action_value: number;
  priority: number;
  enabled: boolean;
  location_id: string | null;
  created_at: string;
  updated_at: string;
  field_config?: {
    id: string;
    name: string;
    label: string;
    field_type: string;
  };
  location?: {
    id: string;
    name: string;
  } | null;
}

export interface InvoiceCalculation {
  job_id: string;
  base_price: number;
  line_items: Array<{
    field_config_id: string;
    field_name: string;
    field_label: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  pricing_rules_applied: Array<{
    rule_id: string;
    rule_name: string;
    adjustment: number;
  }>;
  subtotal: number;
  total_adjustments: number;
  total: number;
  worker_payment_total: number;
  margin: number;
}

export interface FieldPricing {
  id: string;
  organization_id: string;
  field_config_id: string;
  customer_price: number;
  currency: string;
  location_id: string | null;
  pricing_type: PricingType;
  applies_to_field_type: string;
  worker_payment_type: WorkerPaymentType | null;
  worker_payment_value: number | null;
  created_at: string;
  updated_at: string;
  field_config?: {
    id: string;
    name: string;
    label: string;
    field_type: string;
  };
  location?: {
    id: string;
    name: string;
  } | null;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  total: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithJobs extends Invoice {
  invoice_job: Array<{
    job: {
      id: string;
      completed_at: string;
      created_at: string;
      submission_data?: Record<string, unknown> | null;
      location: {
        id: string;
        name: string;
        email: string;
        address: string | null;
        contact_person: string | null;
        phone: string | null;
      } | null;
    };
  }>;
}

export interface CreateInvoiceRequest {
  organization_id: string;
  job_ids: string[];
  due_date: string;
  notes?: string | null;
}

export interface ListInvoicesRequest {
  organization_id: string;
  start_date?: string;
  end_date?: string;
}

export interface LineItemDisplayConfig {
  include_option_value: boolean;
  description_format: string;
  show_base_price_separately: boolean;
}

export interface InvoiceTemplateConfig {
  id: string;
  organization_id: string;
  invoice_title: string;
  show_logo: boolean;
  show_abn: boolean;
  bill_to_fields: string[]; // Array of field_config names to display in Bill To section
  line_item_display: LineItemDisplayConfig;
  created_at: string;
  updated_at: string;
}
