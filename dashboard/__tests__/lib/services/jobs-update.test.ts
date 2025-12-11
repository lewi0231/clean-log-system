import { JobsService } from "@/lib/services/jobs.service";
import type { UpdateJobRequest } from "@/lib/types/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("JobsService.update", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should successfully update a job", async () => {
        const mockRequest: UpdateJobRequest = {
            id: "job-1",
            submission_data: { notes: "Updated notes" },
            location_id: "loc-1",
            worker_ids: ["worker-1"],
            completed_at: "2024-01-01T12:00:00Z",
        };

        const mockResponse = {
            success: true,
            job: {
                id: "job-1",
                organization_id: "org-1",
                location_id: "loc-1",
                submission_data: { notes: "Updated notes" },
                completed_at: "2024-01-01T12:00:00Z",
                created_at: "2024-01-01T10:00:00Z",
                workers: [],
            },
        };

        const { supabase } = await import("@/lib/supabase");
        vi.mocked(supabase.functions.invoke).mockResolvedValue({
            data: mockResponse,
            error: null,
        });

        const result = await JobsService.update(mockRequest);

        expect(result.success).toBe(true);
        expect(result.job.id).toBe("job-1");
        expect(result.job.submission_data).toEqual({ notes: "Updated notes" });
        expect(supabase.functions.invoke).toHaveBeenCalledWith("update-job", {
            body: mockRequest,
        });
    });

    it("should handle update errors", async () => {
        const mockRequest: UpdateJobRequest = {
            id: "job-1",
            submission_data: { notes: "Updated notes" },
        };

        const { supabase } = await import("@/lib/supabase");
        vi.mocked(supabase.functions.invoke).mockResolvedValue({
            data: null,
            error: { message: "Job not found", code: "404" },
        });

        await expect(JobsService.update(mockRequest)).rejects.toThrow();
    });

    it("should handle partial updates", async () => {
        const mockRequest: UpdateJobRequest = {
            id: "job-1",
            submission_data: { notes: "Only notes updated" },
        };

        const mockResponse = {
            success: true,
            job: {
                id: "job-1",
                organization_id: "org-1",
                location_id: null,
                submission_data: { notes: "Only notes updated" },
                completed_at: "2024-01-01T12:00:00Z",
                created_at: "2024-01-01T10:00:00Z",
                workers: [],
            },
        };

        const { supabase } = await import("@/lib/supabase");
        vi.mocked(supabase.functions.invoke).mockResolvedValue({
            data: mockResponse,
            error: null,
        });

        const result = await JobsService.update(mockRequest);

        expect(result.success).toBe(true);
        expect(result.job.submission_data).toEqual({
            notes: "Only notes updated",
        });
    });
});

describe("JobsService.getEdits", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should fetch job edit history", async () => {
        const mockRequest = { job_id: "job-1" };

        const mockResponse = {
            success: true,
            edits: [
                {
                    id: 1,
                    job_id: "job-1",
                    edited_by_email: "admin@example.com",
                    edited_by_user_id: "user-1",
                    action: "UPDATE",
                    old_data: { notes: "Old notes" },
                    new_data: { notes: "New notes" },
                    changed_fields: ["submission_data"],
                    changed_at: "2024-01-01T12:00:00Z",
                },
            ],
        };

        const { supabase } = await import("@/lib/supabase");
        vi.mocked(supabase.functions.invoke).mockResolvedValue({
            data: mockResponse,
            error: null,
        });

        const result = await JobsService.getEdits(mockRequest);

        expect(result.success).toBe(true);
        expect(result.edits).toHaveLength(1);
        expect(result.edits[0].edited_by_email).toBe("admin@example.com");
        expect(result.edits[0].changed_fields).toContain("submission_data");
        expect(supabase.functions.invoke).toHaveBeenCalledWith(
            "get-job-edits",
            {
                body: mockRequest,
            },
        );
    });

    it("should handle empty edit history", async () => {
        const mockRequest = { job_id: "job-1" };

        const mockResponse = {
            success: true,
            edits: [],
        };

        const { supabase } = await import("@/lib/supabase");
        vi.mocked(supabase.functions.invoke).mockResolvedValue({
            data: mockResponse,
            error: null,
        });

        const result = await JobsService.getEdits(mockRequest);

        expect(result.success).toBe(true);
        expect(result.edits).toEqual([]);
    });

    it("should handle fetch errors", async () => {
        const mockRequest = { job_id: "job-1" };

        const { supabase } = await import("@/lib/supabase");
        vi.mocked(supabase.functions.invoke).mockResolvedValue({
            data: null,
            error: { message: "Job not found", code: "404" },
        });

        await expect(JobsService.getEdits(mockRequest)).rejects.toThrow();
    });
});
