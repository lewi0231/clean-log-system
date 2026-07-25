/**
 * Maps Supabase Edge Function names to dashboard request/response shapes.
 *
 * Domain types live in `api.ts` (and focused helpers like `invoice-edge.ts`) so
 * `invokeTypedEdge` can infer `body` + response without `as unknown as Record`.
 *
 * Add entries incrementally when migrating services (see PROJECT_LEARNINGS #10).
 */

import type { SignUpFormData } from "@/lib/validations";
import type { CreateInvoiceRequest, ListInvoicesRequest } from "@/lib/types";
import type {
  CompleteOnboardingRequest,
  CompleteOnboardingResponse,
  ConvertAdminToWorkerRequest,
  ConvertAdminToWorkerResponse,
  CreateJobRequest,
  CreateJobResponse,
  CreateLocationHierarchyRequest,
  CreateLocationHierarchyResponse,
  CreateLocationRequest,
  CreateLocationResponse,
  CreateOrganizationUserRequest,
  CreateOrganizationUserResponse,
  CreateWorkerRequest,
  CreateWorkerResponse,
  DeleteLocationHierarchyRequest,
  DeleteLocationHierarchyResponse,
  DeleteLocationRequest,
  DeleteLocationResponse,
  DeleteOrganizationUserRequest,
  DeleteOrganizationUserResponse,
  DeleteServicePricingModeRequest,
  DeleteServicePricingModeResponse,
  DeleteWorkerRequest,
  DeleteWorkerResponse,
  GetInvoiceTemplateConfigRequest,
  GetInvoiceTemplateConfigResponse,
  GetJobEditsRequest,
  GetJobEditsResponse,
  GetOrganizationSettingsRequest,
  GetOrganizationSettingsResponse,
  ListFeedbackRequest,
  ListFeedbackResponse,
  ListFieldConfigsRequest,
  ListFieldConfigsResponse,
  ListJobsRequest,
  ListJobsResponse,
  ListLocationHierarchyEdgeResponse,
  ListLocationHierarchyRequest,
  ListOrganizationUsersRequest,
  ListOrganizationUsersResponse,
  ListServicePricingModesRequest,
  ListServicePricingModesResponse,
  ListWorkersAndLocationsRequest,
  ListWorkersAndLocationsResponse,
  RefreshOrgSendingDomainStatusRequest,
  RefreshOrgSendingDomainStatusResponse,
  RegisterOrgSendingDomainRequest,
  RegisterOrgSendingDomainResponse,
  RegisterOrganizationResponse,
  RemoveOrgSendingDomainRequest,
  RemoveOrgSendingDomainResponse,
  ResendAdminInvitationRequest,
  ResendAdminInvitationResponse,
  ResendWorkerInvitationRequest,
  ResendWorkerInvitationResponse,
  ResolveFlaggedJobRequest,
  ResolveFlaggedJobResponse,
  SendFeedbackEmailRequest,
  SendFeedbackEmailResponse,
  SendFeedbackTestEmailRequest,
  SendFeedbackTestEmailResponse,
  SendTestOrgSendingDomainEmailRequest,
  SendTestOrgSendingDomainEmailResponse,
  DraftWorkerTaxInvoiceRequest,
  DraftWorkerTaxInvoiceResponse,
  SubmitWorkerTaxInvoiceRequest,
  SubmitWorkerTaxInvoiceResponse,
  ListWorkerTaxInvoicesRequest,
  ListWorkerTaxInvoicesResponse,
  GetWorkerTaxInvoiceRequest,
  GetWorkerTaxInvoiceResponse,
  ReviewWorkerTaxInvoiceRequest,
  ReviewWorkerTaxInvoiceResponse,
  UpdateWorkerTaxInvoiceStatusRequest,
  UpdateWorkerTaxInvoiceStatusResponse,
  GenerateWorkerTaxInvoicePdfRequest,
  GenerateWorkerTaxInvoicePdfResponse,
  UpdateInvoiceTemplateConfigRequest,
  UpdateInvoiceTemplateConfigResponse,
  UpdateJobRequest,
  UpdateJobResponse,
  UpdateOrganizationSettingsRequest,
  UpdateOrganizationSettingsResponse,
  UpdateLocationHierarchyRequest,
  UpdateLocationHierarchyResponse,
  UpdateLocationRequest,
  UpdateLocationResponse,
  UpdateOrganizationUserRequest,
  UpdateOrganizationUserResponse,
  UpdateWorkerRequest,
  UpdateWorkerResponse,
  UpsertServicePricingModeRequest,
  UpsertServicePricingModeResponse,
} from "./api";
import type {
  CalculateInvoiceRequest,
  CalculateInvoiceResponse,
  CreateInvoiceResponse,
  GetInvoiceDetailsRequest,
  GetInvoiceDetailsResponse,
  ListInvoicesResponse,
} from "./invoice-edge";
import type {
  DeletePricingRuleRequest,
  DeletePricingRuleResponse,
  ListPricingHistoryRequest,
  ListPricingHistoryResponse,
  ListPricingRulesRequest,
  ListPricingRulesResponse,
  UpsertPricingRuleRequest,
  UpsertPricingRuleResponse,
} from "./pricing-api";
import type {
  CalculateWorkerPaymentsRequest,
  CalculateWorkerPaymentsResponse,
} from "./worker-payment-edge";

export interface EdgeContracts {
  "admin-create-job": { body: CreateJobRequest; response: CreateJobResponse };
  "calculate-invoice": {
    body: CalculateInvoiceRequest;
    response: CalculateInvoiceResponse;
  };
  "calculate-worker-payment": {
    body: CalculateWorkerPaymentsRequest;
    response: CalculateWorkerPaymentsResponse;
  };
  "complete-onboarding": {
    body: CompleteOnboardingRequest;
    response: CompleteOnboardingResponse;
  };
  "convert-admin-to-worker": {
    body: ConvertAdminToWorkerRequest;
    response: ConvertAdminToWorkerResponse;
  };
  "create-invoice": {
    body: CreateInvoiceRequest;
    response: CreateInvoiceResponse;
  };
  "create-location": {
    body: CreateLocationRequest;
    response: CreateLocationResponse;
  };
  "create-location-hierarchy": {
    body: CreateLocationHierarchyRequest;
    response: CreateLocationHierarchyResponse;
  };
  "create-organization-user": {
    body: CreateOrganizationUserRequest;
    response: CreateOrganizationUserResponse;
  };
  "create-pricing-rule": {
    body: UpsertPricingRuleRequest;
    response: UpsertPricingRuleResponse;
  };
  "create-worker": { body: CreateWorkerRequest; response: CreateWorkerResponse };
  "delete-location": {
    body: DeleteLocationRequest;
    response: DeleteLocationResponse;
  };
  "delete-location-hierarchy": {
    body: DeleteLocationHierarchyRequest;
    response: DeleteLocationHierarchyResponse;
  };
  "delete-organization-user": {
    body: DeleteOrganizationUserRequest;
    response: DeleteOrganizationUserResponse;
  };
  "delete-pricing-rule": {
    body: DeletePricingRuleRequest;
    response: DeletePricingRuleResponse;
  };
  "delete-service-pricing-mode": {
    body: DeleteServicePricingModeRequest;
    response: DeleteServicePricingModeResponse;
  };
  "delete-worker": { body: DeleteWorkerRequest; response: DeleteWorkerResponse };
  "get-invoice-details": {
    body: GetInvoiceDetailsRequest;
    response: GetInvoiceDetailsResponse;
  };
  "get-invoice-template-config": {
    body: GetInvoiceTemplateConfigRequest;
    response: GetInvoiceTemplateConfigResponse;
  };
  "get-job-edits": { body: GetJobEditsRequest; response: GetJobEditsResponse };
  "get-organization-settings": {
    body: GetOrganizationSettingsRequest;
    response: GetOrganizationSettingsResponse;
  };
  "list-feedback": {
    body: ListFeedbackRequest;
    response: ListFeedbackResponse;
  };
  "list-field-configs": {
    body: ListFieldConfigsRequest;
    response: ListFieldConfigsResponse;
  };
  "list-invoices": {
    body: ListInvoicesRequest;
    response: ListInvoicesResponse;
  };
  "list-jobs": { body: ListJobsRequest; response: ListJobsResponse };
  "list-location-hierarchy": {
    body: ListLocationHierarchyRequest;
    response: ListLocationHierarchyEdgeResponse;
  };
  "list-organization-users": {
    body: ListOrganizationUsersRequest;
    response: ListOrganizationUsersResponse;
  };
  "list-pricing-history": {
    body: ListPricingHistoryRequest;
    response: ListPricingHistoryResponse;
  };
  "list-pricing-rules": {
    body: ListPricingRulesRequest;
    response: ListPricingRulesResponse;
  };
  "list-service-pricing-modes": {
    body: ListServicePricingModesRequest;
    response: ListServicePricingModesResponse;
  };
  "list-workers-and-locations": {
    body: ListWorkersAndLocationsRequest;
    response: ListWorkersAndLocationsResponse;
  };
  "refresh-org-sending-domain-status": {
    body: RefreshOrgSendingDomainStatusRequest;
    response: RefreshOrgSendingDomainStatusResponse;
  };
  "register-org-sending-domain": {
    body: RegisterOrgSendingDomainRequest;
    response: RegisterOrgSendingDomainResponse;
  };
  "register-organization": {
    body: SignUpFormData;
    response: RegisterOrganizationResponse;
  };
  "remove-org-sending-domain": {
    body: RemoveOrgSendingDomainRequest;
    response: RemoveOrgSendingDomainResponse;
  };
  "resend-admin-invitation": {
    body: ResendAdminInvitationRequest;
    response: ResendAdminInvitationResponse;
  };
  "resend-worker-invitation": {
    body: ResendWorkerInvitationRequest;
    response: ResendWorkerInvitationResponse;
  };
  "resolve-flagged-job": {
    body: ResolveFlaggedJobRequest;
    response: ResolveFlaggedJobResponse;
  };
  "send-feedback-email": {
    body: SendFeedbackEmailRequest;
    response: SendFeedbackEmailResponse;
  };
  "send-feedback-test-email": {
    body: SendFeedbackTestEmailRequest;
    response: SendFeedbackTestEmailResponse;
  };
  "send-test-org-sending-domain-email": {
    body: SendTestOrgSendingDomainEmailRequest;
    response: SendTestOrgSendingDomainEmailResponse;
  };
  "update-invoice-template-config": {
    body: UpdateInvoiceTemplateConfigRequest;
    response: UpdateInvoiceTemplateConfigResponse;
  };
  "update-job": { body: UpdateJobRequest; response: UpdateJobResponse };
  "update-location": {
    body: UpdateLocationRequest;
    response: UpdateLocationResponse;
  };
  "update-location-hierarchy": {
    body: UpdateLocationHierarchyRequest;
    response: UpdateLocationHierarchyResponse;
  };
  "update-organization-settings": {
    body: UpdateOrganizationSettingsRequest;
    response: UpdateOrganizationSettingsResponse;
  };
  "update-organization-user": {
    body: UpdateOrganizationUserRequest;
    response: UpdateOrganizationUserResponse;
  };
  "update-pricing-rule": {
    body: UpsertPricingRuleRequest;
    response: UpsertPricingRuleResponse;
  };
  "update-worker": { body: UpdateWorkerRequest; response: UpdateWorkerResponse };
  "upsert-service-pricing-mode": {
    body: UpsertServicePricingModeRequest;
    response: UpsertServicePricingModeResponse;
  };
  "draft-worker-tax-invoice": {
    body: DraftWorkerTaxInvoiceRequest;
    response: DraftWorkerTaxInvoiceResponse;
  };
  "submit-worker-tax-invoice": {
    body: SubmitWorkerTaxInvoiceRequest;
    response: SubmitWorkerTaxInvoiceResponse;
  };
  "list-worker-tax-invoices": {
    body: ListWorkerTaxInvoicesRequest;
    response: ListWorkerTaxInvoicesResponse;
  };
  "get-worker-tax-invoice": {
    body: GetWorkerTaxInvoiceRequest;
    response: GetWorkerTaxInvoiceResponse;
  };
  "review-worker-tax-invoice": {
    body: ReviewWorkerTaxInvoiceRequest;
    response: ReviewWorkerTaxInvoiceResponse;
  };
  "update-worker-tax-invoice-status": {
    body: UpdateWorkerTaxInvoiceStatusRequest;
    response: UpdateWorkerTaxInvoiceStatusResponse;
  };
  "generate-worker-tax-invoice-pdf": {
    body: GenerateWorkerTaxInvoicePdfRequest;
    response: GenerateWorkerTaxInvoicePdfResponse;
  };
}
