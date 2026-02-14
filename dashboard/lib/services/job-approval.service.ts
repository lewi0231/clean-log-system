import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";

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

export interface ListFlaggedJobsRequest {
  organization_id: string;
}

export interface FlaggedJob {
  id: string;
  completed_at: string;
  location: {
    id: string;
    name: string;
  } | null;
  workers: Array<{
    id: string;
    name: string;
    confirmation_status: "confirmed" | "pending" | "flagged";
    flag_reason: string | null;
    flagged_at: string | null;
  }>;
  submitted_by_worker_id: string | null;
}

export interface ListFlaggedJobsResponse {
  success: boolean;
  jobs: FlaggedJob[];
}

export class JobApprovalService {
  /**
   * Resolve a flagged job (admin action)
   */
  static async resolveFlaggedJob(
    request: ResolveFlaggedJobRequest
  ): Promise<ResolveFlaggedJobResponse> {
    try {
      log.debug("JobApprovalService: Resolving flagged job", {
        jobId: request.job_id,
        action: request.action,
      });

      const data = await invokeEdgeFunction<ResolveFlaggedJobResponse>(
        "resolve-flagged-job",
        request as unknown as Record<string, unknown>
      );

      if (!data || !data.success) {
        throw new Error("Failed to resolve flagged job");
      }

      log.info("JobApprovalService: Flagged job resolved", {
        jobId: request.job_id,
        action: request.action,
        newStatus: data.job_status,
      });

      return data;
    } catch (err) {
      log.error("JobApprovalService: Failed to resolve flagged job", {
        error: err instanceof Error ? err.message : "Unknown error",
        jobId: request.job_id,
      });
      throw err;
    }
  }

  /**
   * Get count of flagged jobs for the organization
   */
  static getFlaggedJobsFromList(
    jobs: Array<{ approval_status?: string }>
  ): number {
    return jobs.filter((job) => job.approval_status === "flagged").length;
  }

  /**
   * Get count of pending jobs for the organization
   */
  static getPendingJobsFromList(
    jobs: Array<{ approval_status?: string }>
  ): number {
    return jobs.filter((job) => job.approval_status === "pending").length;
  }

  /**
   * Check if a job can be withdrawn (within edit window)
   */
  static canWithdrawJob(job: {
    approval_status?: string;
    edit_window_expires_at?: string | null;
    submitted_by_worker_id?: string | null;
  }): boolean {
    if (job.approval_status !== "pending") {
      return false;
    }
    if (!job.edit_window_expires_at) {
      return false;
    }
    return new Date() < new Date(job.edit_window_expires_at);
  }

  /**
   * Get remaining time until auto-approve
   */
  static getTimeUntilAutoApprove(autoApproveAt: string | null | undefined): {
    hours: number;
    minutes: number;
    expired: boolean;
  } | null {
    if (!autoApproveAt) {
      return null;
    }

    const now = new Date();
    const approveTime = new Date(autoApproveAt);
    const diffMs = approveTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, expired: true };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, expired: false };
  }

  /**
   * Get remaining time in edit window
   */
  static getTimeUntilEditWindowExpires(
    editWindowExpiresAt: string | null | undefined
  ): {
    hours: number;
    minutes: number;
    expired: boolean;
  } | null {
    if (!editWindowExpiresAt) {
      return null;
    }

    const now = new Date();
    const expiresTime = new Date(editWindowExpiresAt);
    const diffMs = expiresTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, expired: true };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, expired: false };
  }
}
