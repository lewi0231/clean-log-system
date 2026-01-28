// Dashboard-specific types only
// Shared types (FieldConfig, FieldType, ValidationRules) are imported from @clean-log/shared/types

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
  name: string; // Computed from first_name + last_name, kept for backward compatibility
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  abn: string | null;
  auth_user_id: string | null;
  active: boolean;
  created_at: string;
}

export type OrganizationUserStatus = "pending" | "active" | "inactive";

export interface OrganizationUser {
  id: string;
  organization_id: string;
  email: string;
  role: "admin" | "viewer";
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: OrganizationUserStatus;
  auth_user_id: string | null;
  invited_at: string;
  activated_at: string | null;
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
  hierarchy_parent_id: string | null;
  hierarchy_parent?: {
    id: string;
    name: string;
    type: "company" | "region";
  } | null;
  pricing_mode?: "field_based" | "fixed_price";
  fixed_customer_price?: number | null;
  fixed_worker_payment?: number | null;
  fixed_price_currency?: string | null;
}

export type BusinessMode = "service_based" | "resource_tracking";

export type SupportedCurrency = "AUD" | "USD" | "GBP" | "EUR" | "CAD" | "NZD";

export type RatingConfigType = "single" | "three_dimensions" | "rater";

export interface RatingConfig {
  type: RatingConfigType;
  dimensions: string[];
}

export interface OrganizationSettings {
  name: string;
  use_predefined_locations: boolean;
  business_mode: BusinessMode;
  abn: string | null;
  logo_url: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  business_address: string | null;
  invoice_send_immediately: boolean;
  feedback_email_send_immediately: boolean;
  rating_config: RatingConfig;
  stripe_account_id: string | null;
  payment_provider: string | null;
  currency: SupportedCurrency;
  locale: string;
  default_exclusive_group_label: string | null;
  auto_generate_invoices_immediately: boolean;
  bank_transfer_bsb: string | null;
  bank_transfer_account_number: string | null;
  bank_transfer_account_name: string | null;
  show_bank_transfer_on_invoices: boolean;
  default_invoice_due_days: number;
  gst_registered: boolean;
  gst_inclusive: boolean;
  gst_rate_percent: number;
}

export interface Job {
  id: string;
  organization_id: string;
  location_id: string | null;
  is_test?: boolean;
  submission_data: Record<string, unknown> | null;
  completed_at: string;
  created_at: string;
  feedback_token?: string | null;
  feedback_email_sent?: boolean | null;
  feedback_email_sent_at?: string | null;
  submitted_by_email?: string | null;
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
  invoice_job?: Array<{
    invoice: {
      id: string;
      invoice_number: string;
      status: InvoiceStatus;
      paid_at: string | null;
    } | null;
  }>;
  has_feedback?: boolean;
}

export type PricingType =
  | "unit"
  | "fixed"
  | "tiered"
  | "percentage"
  | "conditional";
export type WorkerPaymentType = "same_structure" | "percentage" | "fixed_rate";
export type PricingScope = "field" | "option" | "base" | "global";

export interface PricingTier {
  min: number;
  max: number | null;
  price: number;
}

export interface PricingCondition {
  id: string;
  pricing_rule_id: string;
  condition_field_config_id: string;
  operator:
    | "equals"
    | "not_equals"
    | "greater_than"
    | "greater_than_or_equal"
    | "less_than"
    | "less_than_or_equal"
    | "contains";
  condition_value: string;
  action_type: "add" | "subtract" | "multiply" | "divide" | "set";
  action_value: number;
  metadata: Record<string, unknown> | null;
  priority: number;
}

export interface PricingRule {
  id: string;
  organization_id: string;
  scope: PricingScope;
  pricing_type: PricingType;
  pricing_context?: "customer" | "worker"; // Separates customer invoicing from worker payments
  field_config_id: string | null;
  option_value: string | null;
  applies_to_field_type: string | null;
  location_hierarchy_id: string | null;
  location_id: string | null;
  currency: string;
  base_price: number | null;
  percentage_rate: number | null;
  minimum_quantity: number | null;
  maximum_quantity: number | null;
  tier_definition: PricingTier[] | null;
  metadata: Record<string, unknown>;
  worker_payment_type: WorkerPaymentType | null;
  worker_payment_value: number | null;
  priority: number;
  active: boolean;
  effective_at: string;
  expires_at: string | null;
  created_by: string | null;
  updated_by: string | null;
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
  location_node?: {
    id: string;
    name: string;
    type: "company" | "region";
    parent_id: string | null;
  } | null;
  conditions?: PricingCondition[];
}

export interface FieldPricing {
  id: string;
  organization_id: string;
  field_config_id: string;
  location_id: string | null;
  location_hierarchy_id: string | null;
  pricing_type: PricingType;
  customer_price: number;
  currency: string;
  applies_to_field_type: string | null;
  worker_payment_type: WorkerPaymentType | null;
  worker_payment_value: number | null;
  source_rule: PricingRule;
  field_config?: PricingRule["field_config"];
  location?: PricingRule["location"];
  location_node?: PricingRule["location_node"];
}

export interface OptionPricing {
  id: string;
  organization_id: string;
  field_config_id: string;
  option_value: string;
  customer_price: number;
  worker_payment_rate: number | null;
  worker_payment_type: WorkerPaymentType | null;
  location_id: string | null;
  location_hierarchy_id: string | null;
  currency: string;
  source_rule: PricingRule;
  field_config?: PricingRule["field_config"];
  location?: PricingRule["location"];
  location_node?: PricingRule["location_node"];
}

export interface BasePricing {
  id: string;
  organization_id: string;
  job_type_field_config_id: string | null;
  job_type_value: string | null;
  adjustment_type: "add" | "multiply";
  customer_base_price: number;
  worker_base_payment: number | null;
  worker_payment_type: WorkerPaymentType | null;
  location_id: string | null;
  location_hierarchy_id: string | null;
  currency: string;
  source_rule: PricingRule;
  field_config?: PricingRule["field_config"];
  location?: PricingRule["location"];
  location_node?: PricingRule["location_node"];
}

export interface ServicePricingMode {
  id: string;
  organization_id: string;
  location_id: string | null;
  service_type_field_config_id: string;
  service_type_value: string;
  pricing_mode: "field_based" | "fixed_price";
  fixed_customer_price: number | null;
  fixed_worker_payment: number | null;
  fixed_price_currency: string;
  created_at: string;
  updated_at: string;
  field_config?: { id: string; name: string; label: string } | null;
  location?: { id: string; name: string } | null;
}

export interface InvoiceCalculation {
  job_id: string;
  base_price: number;
  line_items: Array<{
    field_config_id: string;
    field_name: string;
    field_label: string;
    option_value?: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  applied_rules: Array<{
    pricing_rule_id: string;
    scope: PricingScope;
    pricing_type: PricingType;
    field_config_id: string | null;
    option_value: string | null;
    location_hierarchy_id: string | null;
    location_id: string | null;
    amount: number;
    worker_payment?: number;
    metadata?: Record<string, unknown>;
  }>;
  subtotal: number;
  total_adjustments: number;
  total: number;
  worker_payment_total: number;
  margin: number;
}

export interface PricingSnapshot {
  id: string;
  organization_id: string;
  invoice_id: string;
  job_id: string | null;
  pricing_rule_id: string | null;
  field_config_id: string | null;
  line_item_key: string | null;
  snapshot_data: Record<string, unknown>;
  captured_at: string;
}

export interface LocationHierarchyNode {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  type: "company" | "region";
  sort_order: number;
  metadata: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  parent?: {
    id: string;
    name: string;
    type: "company" | "region";
  } | null;
}

export type InvoiceStatus =
  | "draft"
  | "pending_review"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  is_test?: boolean;
  subtotal: number;
  total: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Payment tracking fields (from migration)
  payment_link_id?: string | null;
  stripe_customer_id?: string | null;
  bsb?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  total_paid?: number;
  payment_count?: number;
  payment_method_used?: string | null;
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
        hierarchy_parent_id?: string | null;
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
  include_tests?: boolean;
  search?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface PaginationInfo {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

// Re-export payment types for convenience
export type {
  Payment,
  PaymentLink,
  PaymentLinkStatus,
  PaymentMethod,
  PaymentStatus,
} from "./types/payment";

export interface LineItemDisplayConfig {
  include_option_value: boolean;
  description_format: string;
  show_base_price_separately: boolean;
}

export interface ServiceAddressConfig {
  source: "auto" | "location" | "form_fields";
  location_fields?: (
    | "name"
    | "email"
    | "address"
    | "contact_person"
    | "phone"
  )[];
  form_fields?: string[]; // Field config names (for form_fields source)
}

export interface BillingAddressConfig {
  enabled: boolean;
  source: "auto" | "organization" | "hierarchy" | "form_fields";
  form_fields?: string[]; // Field config names (for form_fields source)
}

export interface InvoiceEmailRecipientConfig {
  location_email_source:
    | "location_email"
    | "hierarchy_billing_email"
    | "location_contact_email";
  form_field_email: string | null; // Field config ID that contains email for jobs without location
  /** @deprecated No longer used; fallback removed. Kept for backward compatibility. */
  default_email?: string | null;
}

export interface InvoiceTemplateConfig {
  id: string;
  organization_id: string;
  /** @deprecated Title is now derived from GST registration status. Always sends "Tax Invoice" as default; InvoiceDocument determines actual title. */
  invoice_title: string;
  /** @deprecated Logo is always shown when org has one. Kept for backward compatibility. */
  show_logo: boolean;
  /** @deprecated ABN is always shown when org has one. Kept for backward compatibility. */
  show_abn: boolean;
  /** @deprecated Use service_address_config.form_fields instead. Kept for backward compatibility/migration. */
  bill_to_fields: string[];
  service_address_config?: ServiceAddressConfig;
  billing_address_config?: BillingAddressConfig;
  email_recipient_config?: InvoiceEmailRecipientConfig;
  line_item_display: LineItemDisplayConfig;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  job_id: string;
  rating: number; // 1-5 (overall rating, kept for backward compatibility)
  ratings?: Record<string, number> | null; // Dimension-based ratings: { "overall": 5, "quality": 4, ... }
  comment: string | null;
  submitted_at: string;
  job: {
    id: string;
    completed_at: string;
    location: {
      id: string;
      name: string;
      email: string;
    } | null;
    workers: Array<{
      id: string;
      name: string;
    }>;
  };
}

export interface JobEdit {
  id: number;
  job_id: string;
  edited_by_email: string;
  edited_by_user_id: string | null;
  action: "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[];
  changed_at: string;
}
