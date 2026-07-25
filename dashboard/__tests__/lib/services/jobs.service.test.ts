import { JobsService } from "@/lib/services/jobs.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockJob } from "../fixtures";
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

describe("JobsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return jobs array on success", async () => {
      const mockJobs = [createMockJob(), createMockJob({ id: "job-2" })];

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          jobs: mockJobs,
        },
        error: null,
      });

      const result = await JobsService.list({
        organization_id: "org-1",
      });

      expect(result.success).toBe(true);
      expect(result.jobs).toEqual(mockJobs);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("list-jobs", {
        body: { organization_id: "org-1" },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        JobsService.list({
          organization_id: "org-1",
        })
      ).rejects.toBeInstanceOf(EdgeFunctionError);
      await expect(
        JobsService.list({
          organization_id: "org-1",
        })
      ).rejects.toThrow("Network error");
    });

    it("should throw error when success flag is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { jobs: [] },
        error: null,
      });

      await expect(
        JobsService.list({
          organization_id: "org-1",
        })
      ).rejects.toThrow("Failed to fetch jobs");
    });

    it("should handle empty jobs array", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          jobs: [],
        },
        error: null,
      });

      const result = await JobsService.list({
        organization_id: "org-1",
      });

      expect(result.success).toBe(true);
      expect(result.jobs).toEqual([]);
    });
  });

  describe("sendFeedbackEmail", () => {
    it("forwards confirm flags and returns queued result", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          queued: true,
          message: "Feedback email queued",
          outboxId: "obx-1",
        },
        error: null,
      });

      const result = await JobsService.sendFeedbackEmail("job-1", {
        confirm_resend: true,
        confirm_test: true,
      });

      expect(result.queued).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("send-feedback-email", {
        body: {
          job_id: "job-1",
          confirm_flagged: undefined,
          confirm_test: true,
          confirm_resend: true,
        },
      });
    });
  });
});
