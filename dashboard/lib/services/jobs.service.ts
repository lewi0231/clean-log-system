import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type {
  CreateJobRequest,
  CreateJobResponse,
  GetJobEditsRequest,
  GetJobEditsResponse,
  ListJobsRequest,
  ListJobsResponse,
  UpdateJobRequest,
  UpdateJobResponse,
} from "@/lib/types/api";

export class JobsService {
  /**
   * List jobs for an organization
   */
  static async list(request: ListJobsRequest): Promise<ListJobsResponse> {
    try {
      log.debug("JobsService: Fetching jobs", {
        organizationId: request.organization_id,
      });

      const data = await invokeTypedEdge("list-jobs", request);

      if (!data || !data.success) {
        throw new Error("Failed to fetch jobs");
      }

      log.info("JobsService: Jobs fetched successfully", {
        jobsCount: data.jobs?.length || 0,
      });
      return data;
    } catch (err) {
      log.error("JobsService: Failed to fetch jobs", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create a job (admin only)
   */
  static async create(request: CreateJobRequest): Promise<CreateJobResponse> {
    try {
      log.debug("JobsService: Creating job", {
        organizationId: request.organization_id,
        hasLocationId: !!request.location_id,
        workerIdsCount: request.worker_ids?.length || 0,
      });

      const data = await invokeTypedEdge("admin-create-job", request);

      if (!data || !data.success) {
        throw new Error("Failed to create job");
      }

      log.info("JobsService: Job created successfully", {
        jobId: data.job?.id,
      });
      return data;
    } catch (err) {
      log.error("JobsService: Failed to create job", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Update a job (admin only)
   */
  static async update(request: UpdateJobRequest): Promise<UpdateJobResponse> {
    try {
      log.debug("JobsService: Updating job", {
        jobId: request.id,
        hasLocationId: request.location_id !== undefined,
        hasWorkerIds: !!request.worker_ids,
        hasSubmissionData: !!request.submission_data,
        hasCompletedAt: !!request.completed_at,
      });

      const data = await invokeTypedEdge("update-job", request);

      if (!data || !data.success) {
        throw new Error("Failed to update job");
      }

      log.info("JobsService: Job updated successfully", {
        jobId: data.job?.id,
      });
      return data;
    } catch (err) {
      log.error("JobsService: Failed to update job", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Get edit history for a job
   * Returns empty array if there's an error (e.g., table doesn't exist yet)
   */
  static async getEdits(request: GetJobEditsRequest): Promise<GetJobEditsResponse> {
    try {
      log.debug("JobsService: Fetching job edit history", {
        jobId: request.job_id,
      });

      const data = await invokeTypedEdge("get-job-edits", request);

      if (!data || !data.success) {
        log.error("JobsService: No data returned from get-job-edits", {
          jobId: request.job_id,
        });
        throw new Error("Failed to fetch job edit history");
      }

      log.info("JobsService: Job edit history fetched successfully", {
        jobId: request.job_id,
        editCount: data.edits?.length || 0,
      });
      return data;
    } catch (err) {
      log.error("JobsService: Exception fetching job edit history", {
        error: err instanceof Error ? err.message : "Unknown error",
        jobId: request.job_id,
      });
      throw err;
    }
  }

  /**
   * Send feedback request email for a job
   */
  static async sendFeedbackEmail(jobId: string): Promise<void> {
    try {
      log.debug("JobsService: Sending feedback email", {
        jobId,
      });

      const data = await invokeTypedEdge("send-feedback-email", {
        job_id: jobId,
      });

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to send feedback email");
      }

      log.info("JobsService: Feedback email sent successfully", {
        jobId,
        // Avoid logging provider IDs; only log presence.
        hasEmailId: !!data.emailId,
      });
    } catch (err) {
      log.error("JobsService: Failed to send feedback email", {
        error: err instanceof Error ? err.message : "Unknown error",
        jobId,
      });
      throw err;
    }
  }
}
