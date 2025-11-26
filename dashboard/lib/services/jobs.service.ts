import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { ListJobsRequest, ListJobsResponse } from "@/lib/types/api";

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
}
