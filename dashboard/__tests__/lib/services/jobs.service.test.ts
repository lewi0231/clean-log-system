import { JobsService } from "@/lib/services/jobs.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockJob } from "../fixtures";

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
      ).rejects.toEqual(mockError);
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
});
