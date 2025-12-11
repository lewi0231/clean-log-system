import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
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

      const { data, error } = await supabase.functions.invoke("list-jobs", {
        body: request,
      });

      if (error) {
        throw error;
      }

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

      const { data, error } = await supabase.functions.invoke(
        "admin-create-job",
        {
          body: request,
        },
      );

      if (error) {
        throw error;
      }

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

      const { data, error } = await supabase.functions.invoke("update-job", {
        body: request,
      });

      if (error) {
        throw error;
      }

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
        // Log warning but return empty array instead of throwing
        // This allows the feature to work even if migration hasn't been run
        log.warn(
          "JobsService: Error fetching job edit history (returning empty array)",
          {
            error: error.message || "Unknown error",
            jobId: request.job_id,
          },
        );
        return {
          success: true,
          edits: [],
        };
      }

      if (!data || !data.success) {
        // Return empty array instead of throwing
        log.warn(
          "JobsService: No data returned from get-job-edits (returning empty array)",
          {
            jobId: request.job_id,
          },
        );
        return {
          success: true,
          edits: [],
        };
      }

      log.info("JobsService: Job edit history fetched successfully", {
        jobId: request.job_id,
        editCount: data.edits?.length || 0,
      });
      return data as GetJobEditsResponse;
    } catch (err) {
      // Log error but return empty array instead of throwing
      // This prevents errors from breaking the UI
      log.warn(
        "JobsService: Exception fetching job edit history (returning empty array)",
        {
          error: err instanceof Error ? err.message : "Unknown error",
          jobId: request.job_id,
        },
      );
      return {
        success: true,
        edits: [],
      };
    }
  }
}
