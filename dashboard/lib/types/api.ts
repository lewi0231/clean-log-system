// API request and response types for Supabase Edge Functions

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
  name: string;
  email: string;
  phone: string;
}

export interface UpdateWorkerRequest {
  id: string;
  name?: string;
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
}

export interface UpdateOrganizationUserRequest {
  id: string;
  role?: "admin" | "viewer";
}

export interface DeleteOrganizationUserRequest {
  id: string;
}

// Locations API
export interface CreateLocationRequest {
  organization_id: string;
  name: string;
  email: string;
  address: string;
  contact_person: string;
  phone?: string;
}

export interface UpdateLocationRequest {
  id: string;
  name?: string;
  email?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
}

export interface DeleteLocationRequest {
  id: string;
}

// Jobs API
export interface ListJobsRequest {
  organization_id: string;
}

export interface ListJobsResponse {
  success: boolean;
  jobs: Job[];
}

// Field Configs API
export interface ListFieldConfigsRequest {
  organization_id: string;
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
import type { FieldConfig } from "@/shared/types/field-config";
import type {
  BusinessMode,
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
