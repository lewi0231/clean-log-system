/**
 * Maps Supabase Edge Function names to dashboard request/response shapes.
 *
 * Domain types live in `api.ts`; this file wires them to deployed function names so
 * `invokeTypedEdge` can infer `body` + response without `as unknown as Record`.
 *
 * Add entries incrementally when migrating services (see PROJECT_LEARNINGS #10).
 */

import type {
  CreateJobRequest,
  CreateJobResponse,
  GetJobEditsRequest,
  GetJobEditsResponse,
  ListJobsRequest,
  ListJobsResponse,
  SendFeedbackEmailRequest,
  SendFeedbackEmailResponse,
  UpdateJobRequest,
  UpdateJobResponse,
} from "./api";

export interface EdgeContracts {
  "admin-create-job": { body: CreateJobRequest; response: CreateJobResponse };
  "get-job-edits": { body: GetJobEditsRequest; response: GetJobEditsResponse };
  "list-jobs": { body: ListJobsRequest; response: ListJobsResponse };
  "send-feedback-email": {
    body: SendFeedbackEmailRequest;
    response: SendFeedbackEmailResponse;
  };
  "update-job": { body: UpdateJobRequest; response: UpdateJobResponse };
}
