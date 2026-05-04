/**
 * Maps Supabase Edge Function names to dashboard request/response shapes.
 *
 * Domain types live in `api.ts`; this file wires them to deployed function names so
 * `invokeTypedEdge` can infer `body` + response without `as unknown as Record`.
 *
 * Add entries incrementally when migrating services (see PROJECT_LEARNINGS #10).
 */

import type {
  ConvertAdminToWorkerRequest,
  ConvertAdminToWorkerResponse,
  CreateJobRequest,
  CreateJobResponse,
  CreateOrganizationUserRequest,
  CreateOrganizationUserResponse,
  CreateWorkerRequest,
  CreateWorkerResponse,
  DeleteOrganizationUserRequest,
  DeleteOrganizationUserResponse,
  DeleteWorkerRequest,
  DeleteWorkerResponse,
  GetJobEditsRequest,
  GetJobEditsResponse,
  ListJobsRequest,
  ListJobsResponse,
  ListOrganizationUsersRequest,
  ListOrganizationUsersResponse,
  ListWorkersAndLocationsRequest,
  ListWorkersAndLocationsResponse,
  ResendAdminInvitationRequest,
  ResendAdminInvitationResponse,
  ResendWorkerInvitationRequest,
  ResendWorkerInvitationResponse,
  SendFeedbackEmailRequest,
  SendFeedbackEmailResponse,
  UpdateJobRequest,
  UpdateJobResponse,
  UpdateOrganizationUserRequest,
  UpdateOrganizationUserResponse,
  UpdateWorkerRequest,
  UpdateWorkerResponse,
} from "./api";

export interface EdgeContracts {
  "admin-create-job": { body: CreateJobRequest; response: CreateJobResponse };
  "convert-admin-to-worker": {
    body: ConvertAdminToWorkerRequest;
    response: ConvertAdminToWorkerResponse;
  };
  "create-organization-user": {
    body: CreateOrganizationUserRequest;
    response: CreateOrganizationUserResponse;
  };
  "create-worker": { body: CreateWorkerRequest; response: CreateWorkerResponse };
  "delete-organization-user": {
    body: DeleteOrganizationUserRequest;
    response: DeleteOrganizationUserResponse;
  };
  "delete-worker": { body: DeleteWorkerRequest; response: DeleteWorkerResponse };
  "get-job-edits": { body: GetJobEditsRequest; response: GetJobEditsResponse };
  "list-jobs": { body: ListJobsRequest; response: ListJobsResponse };
  "list-organization-users": {
    body: ListOrganizationUsersRequest;
    response: ListOrganizationUsersResponse;
  };
  "list-workers-and-locations": {
    body: ListWorkersAndLocationsRequest;
    response: ListWorkersAndLocationsResponse;
  };
  "resend-admin-invitation": {
    body: ResendAdminInvitationRequest;
    response: ResendAdminInvitationResponse;
  };
  "resend-worker-invitation": {
    body: ResendWorkerInvitationRequest;
    response: ResendWorkerInvitationResponse;
  };
  "send-feedback-email": {
    body: SendFeedbackEmailRequest;
    response: SendFeedbackEmailResponse;
  };
  "update-job": { body: UpdateJobRequest; response: UpdateJobResponse };
  "update-organization-user": {
    body: UpdateOrganizationUserRequest;
    response: UpdateOrganizationUserResponse;
  };
  "update-worker": { body: UpdateWorkerRequest; response: UpdateWorkerResponse };
}
