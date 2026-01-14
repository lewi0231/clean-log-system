import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
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
import { supabase } from "../supabase";

export class JobsService {
  /**
   * List jobs for an organization
   */
  static async list(request: ListJobsRequest): Promise<ListJobsResponse> {
    try {
      log.debug("JobsService: Fetching jobs", {
        organizationId: request.organization_id,
      });

      const data = await invokeEdgeFunction<ListJobsResponse>(
        "list-jobs",
        request as unknown as Record<string, unknown>,
      );

      if (!data || !data.success) {
        throw new Error("Failed to fetch jobs");
      }

      log.info("JobsService: Jobs fetched successfully", {
        jobsCount: data.jobs?.length || 0,
      });
      return data as ListJobsResponse;
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

      const data = await invokeEdgeFunction<CreateJobResponse>(
        "admin-create-job",
        request as unknown as Record<string, unknown>,
      );

      if (!data || !data.success) {
        throw new Error("Failed to create job");
      }

      log.info("JobsService: Job created successfully", {
        jobId: data.job?.id,
      });
      return data as CreateJobResponse;
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

      const data = await invokeEdgeFunction<UpdateJobResponse>(
        "update-job",
        request as unknown as Record<string, unknown>,
      );

      if (!data || !data.success) {
        throw new Error("Failed to update job");
      }

      log.info("JobsService: Job updated successfully", {
        jobId: data.job?.id,
      });
      return data as UpdateJobResponse;
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
  static async getEdits(
    request: GetJobEditsRequest,
  ): Promise<GetJobEditsResponse> {
    try {
      log.debug("JobsService: Fetching job edit history", {
        jobId: request.job_id,
      });

      const { data, error } = await supabase.functions.invoke("get-job-edits", {
        body: request,
      });

      if (error) {
        log.error("JobsService: Error fetching job edit history", {
          error: error.message || "Unknown error",
          jobId: request.job_id,
        });
        throw error;
      }

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
      return data as GetJobEditsResponse;
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

      const { data, error } = await supabase.functions.invoke(
        "send-feedback-email",
        {
          body: { job_id: jobId },
        },
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to send feedback email");
      }

      log.info("JobsService: Feedback email sent successfully", {
        jobId,
        emailId: data.emailId,
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
