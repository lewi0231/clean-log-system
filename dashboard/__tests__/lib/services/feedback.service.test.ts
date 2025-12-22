import { FeedbackService } from "@/lib/services/feedback.service";
import { supabase } from "@/lib/supabase";
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

describe("FeedbackService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("list", () => {
        it("should list feedback successfully", async () => {
            const mockResponse = {
                success: true,
                feedback: [
                    {
                        id: "feedback-1",
                        job_id: "job-1",
                        rating: 5,
                        comment: "Great service!",
                        created_at: "2024-01-15T10:00:00Z",
                    },
                    {
                        id: "feedback-2",
                        job_id: "job-2",
                        rating: 4,
                        comment: "Good work",
                        created_at: "2024-01-16T10:00:00Z",
                    },
                ],
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await FeedbackService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual(mockResponse);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-feedback",
                {
                    body: {
                        organization_id: "org-1",
                    },
                },
            );
        });

        it("should return empty feedback array", async () => {
            const mockResponse = {
                success: true,
                feedback: [],
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await FeedbackService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual(mockResponse);
            expect(result.feedback).toEqual([]);
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                FeedbackService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toEqual(mockError);
        });

        it("should throw error when success is false", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(
                FeedbackService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("Failed to fetch feedback");
        });
    });
});
