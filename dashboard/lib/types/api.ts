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
}

export interface UpdateWorkerRequest {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

export interface DeleteWorkerRequest {
  id: string;
}

export interface ResendWorkerInvitationRequest {
  worker_id: string;
  organization_id: string;
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
}

export interface DeleteLocationRequest {
  id: string;
}

// Jobs API
export interface ListJobsRequest {
  organization_id: string;
  include_tests?: boolean;
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

// Feedback API
export interface ListFeedbackRequest {
  organization_id: string;
}

export interface ListFeedbackResponse {
  success: boolean;
  feedback: Feedback[];
}

// Field Configs API
export interface ListFieldConfigsRequest {
  organization_id: string;
  location_id?: string | null;
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

export interface UpdateOrganizationSettingsRequest {
  organization_id: string;
  use_predefined_locations?: boolean;
  business_mode?: BusinessMode;
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

// Common types (re-exported from lib/types.ts for convenience)
import type { FieldConfig } from "@clean-log/shared/types";
import type {
  BusinessMode,
  Feedback,
  FieldPricing,
  Job,
  Location,
  OrganizationSettings,
  OrganizationUser,
  Worker,
} from "../types";

// API Error Response
export interface ApiErrorResponse {
  error: string;
}
