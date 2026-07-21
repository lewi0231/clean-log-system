// API request and response types for Supabase Edge Functions
import type { JobEdit } from "../types";

// Workers API
export interface ListWorkersAndLocationsRequest {
  organization_id: string;
}

export interface ListWorkersAndLocationsResponse {
  success: boolean;
  workers: Worker[];
  locations: Location[];
}

export interface CreateWorkerRequest {
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  engagement_type?: "employee" | "contractor";
}

/** Result of create-worker edge function (includes email delivery flags). */
export interface CreateWorkerResult {
  worker: Worker;
  emailSent: boolean;
  emailError?: string;
}

export interface UpdateWorkerRequest {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  engagement_type?: "employee" | "contractor";
}

export interface DeleteWorkerRequest {
  id: string;
}

export interface ResendWorkerInvitationRequest {
  worker_id: string;
  organization_id: string;
}

/** Raw JSON from `create-worker` Edge Function (snake_case email flags). */
export interface CreateWorkerResponse {
  worker?: Worker;
  email_sent?: boolean;
  email_error?: string;
}

export interface UpdateWorkerResponse {
  worker?: Worker;
}

export interface DeleteWorkerResponse {
  success?: boolean;
}

export interface ResendWorkerInvitationResponse {
  success?: boolean;
}

// Organization Users API
export interface ListOrganizationUsersRequest {
  organization_id: string;
}

export interface ListOrganizationUsersResponse {
  success: boolean;
  organization_users: OrganizationUser[];
}

export interface CreateOrganizationUserRequest {
  organization_id: string;
  email: string;
  role: "admin" | "viewer";
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface UpdateOrganizationUserRequest {
  id: string;
  role?: "admin" | "viewer";
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: "active" | "inactive";
}

export interface DeleteOrganizationUserRequest {
  id: string;
}

export interface ResendAdminInvitationRequest {
  organization_user_id: string;
  organization_id: string;
}

export interface CreateOrganizationUserResponse {
  organization_user?: OrganizationUser;
  invitation_sent?: boolean;
  existing_user?: boolean;
  message?: string;
}

export interface UpdateOrganizationUserResponse {
  organization_user?: OrganizationUser;
}

export interface DeleteOrganizationUserResponse {
  success?: boolean;
}

export interface ResendAdminInvitationResponse {
  success?: boolean;
  message?: string;
}

export interface ConvertAdminToWorkerRequest {
  organization_user_id: string;
  organization_id: string;
}

export interface ConvertAdminToWorkerResponse {
  success?: boolean;
  message?: string;
  worker?: { id?: string };
  worker_id?: string;
  already_worker?: boolean;
}

// Locations API
export interface CreateLocationRequest {
  organization_id: string;
  name: string;
  email: string;
  address: string;
  contact_person: string;
  phone?: string;
  hierarchy_parent_id?: string | null;
  pricing_mode?: "field_based" | "fixed_price";
  fixed_customer_price?: number | null;
  fixed_worker_payment?: number | null;
  fixed_price_currency?: string | null;
  feedback_requests_enabled?: boolean;
}

export interface UpdateLocationRequest {
  id: string;
  name?: string;
  email?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  hierarchy_parent_id?: string | null;
  active?: boolean;
  pricing_mode?: "field_based" | "fixed_price";
  fixed_customer_price?: number | null;
  fixed_worker_payment?: number | null;
  fixed_price_currency?: string | null;
  feedback_requests_enabled?: boolean;
}

export interface DeleteLocationRequest {
  id: string;
}

export interface CreateLocationResponse {
  location?: Location;
}

export interface UpdateLocationResponse {
  location?: Location;
}

export interface DeleteLocationResponse {
  success?: boolean;
}

/** Edge JSON from `list-location-hierarchy` */
export interface ListLocationHierarchyEdgeResponse {
  success?: boolean;
  nodes?: LocationHierarchyNode[];
}

export interface ListLocationHierarchyRequest {
  organization_id: string;
}

export interface CreateLocationHierarchyRequest {
  organization_id: string;
  name: string;
  type: "company" | "region";
  parent_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateLocationHierarchyResponse {
  success?: boolean;
  node?: LocationHierarchyNode;
}

export interface UpdateLocationHierarchyRequest {
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateLocationHierarchyResponse {
  success?: boolean;
  node?: LocationHierarchyNode;
}

export interface DeleteLocationHierarchyRequest {
  id: string;
}

export interface DeleteLocationHierarchyResponse {
  success?: boolean;
  message?: string;
}

// Jobs API
export interface ListJobsRequest {
  organization_id: string;
  include_tests?: boolean;
  worker_id?: string;
  mine?: boolean;
}

export interface ListJobsResponse {
  success: boolean;
  jobs: Job[];
}

export interface CreateJobRequest {
  organization_id: string;
  location_id?: string | null;
  worker_ids?: string[];
  submission_data: Record<string, unknown>;
  completed_at?: string; // ISO timestamp, defaults to now
}

export interface CreateJobResponse {
  success: boolean;
  job: {
    id: string;
    organization_id: string;
    location_id: string | null;
    completed_at: string;
    created_at: string;
  };
}

export interface UpdateJobRequest {
  id: string;
  location_id?: string | null;
  worker_ids?: string[];
  submission_data?: Record<string, unknown>;
  completed_at?: string; // ISO timestamp
}

export interface UpdateJobResponse {
  success: boolean;
  job: Job;
}

export interface GetJobEditsRequest {
  job_id: string;
}

export interface GetJobEditsResponse {
  success: boolean;
  edits: JobEdit[];
}

/** Edge function `send-feedback-email` */
export interface SendFeedbackEmailRequest {
  job_id: string;
}

export interface SendFeedbackEmailResponse {
  success?: boolean;
  error?: string;
  emailId?: string;
}

// Feedback API
export interface ListFeedbackRequest {
  organization_id: string;
}

export interface ListFeedbackResponse {
  success: boolean;
  feedback: Feedback[];
}

// Field Configs API
/**
 * Request for `list-field-configs`. `line_of_business_id` is reserved for future service-line
 * filtering; it is ignored by the edge function until LOB is implemented (safe to omit).
 */
export interface ListFieldConfigsRequest {
  organization_id: string;
  location_id?: string | null;
  /** Reserved: filter field catalog by line of business (not applied yet). */
  line_of_business_id?: string | null;
}

export interface ListFieldConfigsResponse {
  success: boolean;
  field_configs: FieldConfig[];
}

// Organization Settings API
export interface GetOrganizationSettingsRequest {
  organization_id: string;
}

export interface GetOrganizationSettingsResponse {
  success: boolean;
  settings: OrganizationSettings;
}

export interface UpdateOrganizationSettingsResponse {
  success: boolean;
  settings: OrganizationSettings;
}

export type UpdateOrganizationSettingsRequest = {
  organization_id: string;
} & Partial<OrganizationSettings>;

/** `refresh-org-sending-domain-status` */
export interface RefreshOrgSendingDomainStatusRequest {
  organization_id: string;
}

export interface RefreshOrgSendingDomainStatusResponse {
  success: boolean;
  resend_status: string;
  display_status: string;
  dns_records: unknown;
  domain_name: string;
}

/** `remove-org-sending-domain` */
export interface RemoveOrgSendingDomainRequest {
  organization_id: string;
}

export interface RemoveOrgSendingDomainResponse {
  success: boolean;
}

/** `register-org-sending-domain` */
export interface RegisterOrgSendingDomainRequest {
  organization_id: string;
  domain_name: string;
}

export interface RegisterOrgSendingDomainResponse {
  success: boolean;
  resend_domain_id?: string;
  domain_name: string;
  resend_status: string;
  display_status: string;
  dns_records: unknown;
  reusedExisting?: boolean;
}

/** `send-test-org-sending-domain-email` */
export interface SendTestOrgSendingDomainEmailRequest {
  organization_id: string;
}

export interface SendTestOrgSendingDomainEmailResponse {
  success: boolean;
  to: string;
  from: string;
  domain_name: string;
  email_id?: string | null;
  skipped?: boolean;
}

// Field Pricing API
export interface ListFieldPricingRequest {
  organization_id: string;
}

export interface ListFieldPricingResponse {
  success: boolean;
  field_pricing: FieldPricing[];
}

export interface UpsertFieldPricingRequest {
  organization_id: string;
  field_config_id: string;
  unit_price: number;
  currency?: string;
}

export interface UpsertFieldPricingResponse {
  success: boolean;
  field_pricing: FieldPricing;
}

export interface DeleteFieldPricingRequest {
  id: string;
}

export interface DeleteFieldPricingResponse {
  success: boolean;
}

// Job approval API (Edge)
export interface ResolveFlaggedJobRequest {
  job_id: string;
  action: "approve" | "cancel";
  admin_notes?: string;
}

export interface ResolveFlaggedJobResponse {
  success: boolean;
  message: string;
  job_status: "approved" | "cancelled";
}

// Service pricing modes API (Edge)
export interface ListServicePricingModesRequest {
  organization_id: string;
  location_id?: string | null;
  service_type_field_config_id?: string;
  service_type_value?: string;
}

export interface ListServicePricingModesResponse {
  success?: boolean;
  error?: string;
  service_pricing_modes?: ServicePricingMode[];
}

export interface UpsertServicePricingModeRequest {
  organization_id: string;
  service_type_field_config_id: string;
  service_type_value: string;
  pricing_mode: "field_based" | "fixed_price";
  fixed_customer_price?: number | null;
  fixed_worker_payment?: number | null;
  fixed_price_currency?: string;
  location_id?: string | null;
}

export interface UpsertServicePricingModeResponse {
  success?: boolean;
  error?: string;
  service_pricing_mode?: ServicePricingMode;
}

export interface DeleteServicePricingModeRequest {
  id: string;
}

export interface DeleteServicePricingModeResponse {
  success?: boolean;
  error?: string;
}

// Invoice template API (Edge)
export interface GetInvoiceTemplateConfigRequest {
  organization_id: string;
}

export interface GetInvoiceTemplateConfigResponse {
  success: boolean;
  config: InvoiceTemplateConfig;
}

export interface UpdateInvoiceTemplateConfigRequest {
  organization_id: string;
  invoice_title?: string;
  show_logo?: boolean;
  show_abn?: boolean;
  bill_to_fields?: string[];
  service_address_config?: ServiceAddressConfig;
  billing_address_config?: BillingAddressConfig;
  email_recipient_config?: InvoiceEmailRecipientConfig;
  line_item_display?: Partial<LineItemDisplayConfig>;
}

export interface UpdateInvoiceTemplateConfigResponse {
  success: boolean;
  config: InvoiceTemplateConfig;
}

// Onboarding + signup (Edge)
export interface CompleteOnboardingRequest {
  industry_type: string;
  employee_count: "none" | "1-5" | "6-20" | "21-50" | "50+";
  abn: string;
  has_locations: boolean;
  /** Soft signal: some sites belong to the same company/client group (introduces hierarchy later). */
  has_company_client_groups: boolean;
  has_workers: boolean;
  /**
   * Settlement mode in Tally (not legal classification).
   * Required when has_workers / employee_count !== none.
   */
  workforce_engagement?: "employees" | "contractors" | "both" | null;
  /** Preference only — not used for payroll. `per_job` = output / piece rate. */
  worker_payment_method: "hourly" | "per_job" | null;
  worker_payment_frequency: "weekly" | "fortnightly" | "monthly" | null;
  invoice_frequency: "immediately" | "daily" | "weekly" | "monthly";
  invoice_weekly_day: number | null;
  invoice_monthly_day: number | null;
  auto_generate_invoices: boolean;
}

export interface CompleteOnboardingResponse {
  success: boolean;
  organizationId: string;
}

export interface RegisterOrganizationResponse {
  organization?: { id?: string; org_code?: string };
  error?: string;
}

// Common types (re-exported from lib/types.ts for convenience)
import type { FieldConfig } from "@clean-log/shared/types";
import type {
  BillingAddressConfig,
  Feedback,
  FieldPricing,
  InvoiceEmailRecipientConfig,
  InvoiceTemplateConfig,
  Job,
  LineItemDisplayConfig,
  Location,
  LocationHierarchyNode,
  OrganizationSettings,
  OrganizationUser,
  ServiceAddressConfig,
  ServicePricingMode,
  Worker,
  WorkerTaxInvoice,
} from "../types";

// API Error Response
export interface ApiErrorResponse {
  error: string;
}

// Worker Tax Invoice API
export interface DraftWorkerTaxInvoiceRequest {
  organization_id: string;
  job_ids: string[];
}

export interface DraftWorkerTaxInvoiceResponse {
  success?: boolean;
  invoice?: WorkerTaxInvoice;
}

export interface SubmitWorkerTaxInvoiceRequest {
  organization_id: string;
  invoice_id: string;
}

export interface SubmitWorkerTaxInvoiceResponse {
  success?: boolean;
  invoice?: WorkerTaxInvoice;
}

export interface ListWorkerTaxInvoicesRequest {
  organization_id: string;
  worker_id?: string;
}

export interface ListWorkerTaxInvoicesResponse {
  success?: boolean;
  invoices?: WorkerTaxInvoice[];
}

export interface GetWorkerTaxInvoiceRequest {
  organization_id: string;
  invoice_id: string;
}

export interface GetWorkerTaxInvoiceResponse {
  success?: boolean;
  invoice?: WorkerTaxInvoice;
}

export interface ReviewWorkerTaxInvoiceRequest {
  organization_id: string;
  invoice_id: string;
  action: "approve" | "reject";
  review_notes?: string | null;
}

export interface ReviewWorkerTaxInvoiceResponse {
  success?: boolean;
  invoice?: WorkerTaxInvoice;
}

export interface UpdateWorkerTaxInvoiceStatusRequest {
  organization_id: string;
  invoice_id: string;
  action: "cancel" | "mark_paid";
}

export interface UpdateWorkerTaxInvoiceStatusResponse {
  success?: boolean;
  invoice?: WorkerTaxInvoice;
}

export interface GenerateWorkerTaxInvoicePdfRequest {
  organization_id: string;
  invoice_id: string;
}

export interface GenerateWorkerTaxInvoicePdfResponse {
  success?: boolean;
  html?: string;
  invoice_number?: string | null;
}
