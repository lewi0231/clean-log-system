import { JobApprovalService } from "@/lib/services/job-approval.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { createMockFlaggedJob, createMockJob, createMockPendingJob } from "../fixtures";
import { EdgeFunctionError } from "@/lib/supabase/invoke-edge-function";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("JobApprovalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("resolveFlaggedJob", () => {
    it("should resolve flagged job with approve action", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          message: "Job approved successfully",
          job_status: "approved",
        },
        error: null,
      });

      const result = await JobApprovalService.resolveFlaggedJob({
        job_id: "job-1",
        action: "approve",
      });

      expect(result.success).toBe(true);
      expect(result.job_status).toBe("approved");
      expect(supabase.functions.invoke).toHaveBeenCalledWith("resolve-flagged-job", {
        body: { job_id: "job-1", action: "approve" },
      });
    });

    it("should resolve flagged job with cancel action", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          message: "Job cancelled successfully",
          job_status: "cancelled",
        },
        error: null,
      });

      const result = await JobApprovalService.resolveFlaggedJob({
        job_id: "job-1",
        action: "cancel",
      });

      expect(result.success).toBe(true);
      expect(result.job_status).toBe("cancelled");
    });

    it("should include admin_notes when provided", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          message: "Job approved successfully",
          job_status: "approved",
        },
        error: null,
      });

      await JobApprovalService.resolveFlaggedJob({
        job_id: "job-1",
        action: "approve",
        admin_notes: "Verified with worker directly",
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith("resolve-flagged-job", {
        body: {
          job_id: "job-1",
          action: "approve",
          admin_notes: "Verified with worker directly",
        },
      });
    });

    it("should throw error on failure", async () => {
      const mockError = { message: "Job not found", status: 404 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        JobApprovalService.resolveFlaggedJob({
          job_id: "job-invalid",
          action: "approve",
        })
      ).rejects.toBeInstanceOf(EdgeFunctionError);
    });
  });

  describe("getFlaggedJobsFromList", () => {
    it("should return count of flagged jobs", () => {
      const jobs = [
        createMockJob({ id: "job-1", approval_status: "approved" }),
        createMockFlaggedJob({ id: "job-2" }),
        createMockPendingJob({ id: "job-3" }),
        createMockFlaggedJob({ id: "job-4" }),
      ];

      const count = JobApprovalService.getFlaggedJobsFromList(jobs);

      expect(count).toBe(2);
    });

    it("should return 0 when no flagged jobs", () => {
      const jobs = [createMockJob({ id: "job-1" }), createMockPendingJob({ id: "job-2" })];

      const count = JobApprovalService.getFlaggedJobsFromList(jobs);

      expect(count).toBe(0);
    });

    it("should handle empty array", () => {
      const count = JobApprovalService.getFlaggedJobsFromList([]);

      expect(count).toBe(0);
    });
  });

  describe("getPendingJobsFromList", () => {
    it("should return count of pending jobs", () => {
      const jobs = [
        createMockJob({ id: "job-1", approval_status: "approved" }),
        createMockPendingJob({ id: "job-2" }),
        createMockPendingJob({ id: "job-3" }),
        createMockFlaggedJob({ id: "job-4" }),
      ];

      const count = JobApprovalService.getPendingJobsFromList(jobs);

      expect(count).toBe(2);
    });

    it("should return 0 when no pending jobs", () => {
      const jobs = [createMockJob({ id: "job-1" }), createMockFlaggedJob({ id: "job-2" })];

      const count = JobApprovalService.getPendingJobsFromList(jobs);

      expect(count).toBe(0);
    });
  });

  describe("canWithdrawJob", () => {
    it("should return true when within edit window", () => {
      const job = {
        approval_status: "pending" as const,
        edit_window_expires_at: "2024-01-15T13:00:00Z", // 1 hour from now
        submitted_by_worker_id: "worker-1",
      };

      const canWithdraw = JobApprovalService.canWithdrawJob(job);

      expect(canWithdraw).toBe(true);
    });

    it("should return false when edit window expired", () => {
      const job = {
        approval_status: "pending" as const,
        edit_window_expires_at: "2024-01-15T11:00:00Z", // 1 hour ago
        submitted_by_worker_id: "worker-1",
      };

      const canWithdraw = JobApprovalService.canWithdrawJob(job);

      expect(canWithdraw).toBe(false);
    });

    it("should return false when job is not pending", () => {
      const job = {
        approval_status: "approved" as const,
        edit_window_expires_at: "2024-01-15T15:00:00Z",
        submitted_by_worker_id: "worker-1",
      };

      const canWithdraw = JobApprovalService.canWithdrawJob(job);

      expect(canWithdraw).toBe(false);
    });

    it("should return false when no edit_window_expires_at", () => {
      const job = {
        approval_status: "pending" as const,
        edit_window_expires_at: null,
        submitted_by_worker_id: "worker-1",
      };

      const canWithdraw = JobApprovalService.canWithdrawJob(job);

      expect(canWithdraw).toBe(false);
    });

    it("should return false for flagged jobs", () => {
      const job = {
        approval_status: "flagged" as const,
        edit_window_expires_at: "2024-01-15T15:00:00Z",
        submitted_by_worker_id: "worker-1",
      };

      const canWithdraw = JobApprovalService.canWithdrawJob(job);

      expect(canWithdraw).toBe(false);
    });
  });

  describe("getTimeUntilAutoApprove", () => {
    it("should return hours and minutes until auto-approve", () => {
      const autoApproveAt = "2024-01-15T14:30:00Z"; // 2h 30m from now

      const result = JobApprovalService.getTimeUntilAutoApprove(autoApproveAt);

      expect(result).toEqual({ hours: 2, minutes: 30, expired: false });
    });

    it("should return expired when time has passed", () => {
      const autoApproveAt = "2024-01-15T10:00:00Z"; // 2 hours ago

      const result = JobApprovalService.getTimeUntilAutoApprove(autoApproveAt);

      expect(result).toEqual({ hours: 0, minutes: 0, expired: true });
    });

    it("should return null when no auto_approve_at", () => {
      const result = JobApprovalService.getTimeUntilAutoApprove(null);

      expect(result).toBeNull();
    });

    it("should return null for undefined", () => {
      const result = JobApprovalService.getTimeUntilAutoApprove(undefined);

      expect(result).toBeNull();
    });

    it("should handle time exactly at auto-approve", () => {
      const autoApproveAt = "2024-01-15T12:00:00Z"; // Exactly now

      const result = JobApprovalService.getTimeUntilAutoApprove(autoApproveAt);

      expect(result?.expired).toBe(true);
    });
  });

  describe("getTimeUntilEditWindowExpires", () => {
    it("should return hours and minutes until window expires", () => {
      const editWindowExpiresAt = "2024-01-15T13:45:00Z"; // 1h 45m from now

      const result = JobApprovalService.getTimeUntilEditWindowExpires(editWindowExpiresAt);

      expect(result).toEqual({ hours: 1, minutes: 45, expired: false });
    });

    it("should return expired when window has passed", () => {
      const editWindowExpiresAt = "2024-01-15T11:00:00Z"; // 1 hour ago

      const result = JobApprovalService.getTimeUntilEditWindowExpires(editWindowExpiresAt);

      expect(result).toEqual({ hours: 0, minutes: 0, expired: true });
    });

    it("should return null when no edit_window_expires_at", () => {
      const result = JobApprovalService.getTimeUntilEditWindowExpires(null);

      expect(result).toBeNull();
    });
  });
});
