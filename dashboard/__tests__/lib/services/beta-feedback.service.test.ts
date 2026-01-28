import {
  submitBetaFeedback,
  type SubmitBetaFeedbackParams,
} from "@/lib/services/beta-feedback.service";
import { supabase } from "@/lib/supabase";
import { EdgeFunctionError } from "@/lib/supabase/invoke-edge-function";
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

describe("beta-feedback.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitBetaFeedback", () => {
    it("should call submit-beta-feedback with required params and return success", async () => {
      const mockResponse = {
        success: true,
        id: "pf-123",
        created_at: "2026-01-28T12:00:00Z",
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const params: SubmitBetaFeedbackParams = {
        organization_id: "org-1",
        message: "The pricing page is confusing",
      };

      const result = await submitBetaFeedback(params);

      expect(result).toEqual(mockResponse);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "submit-beta-feedback",
        {
          body: {
            organization_id: "org-1",
            message: "The pricing page is confusing",
          },
        },
      );
    });

    it("should include optional category and page_path when provided", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true, id: "pf-456", created_at: "2026-01-28T12:00:00Z" },
        error: null,
      });

      await submitBetaFeedback({
        organization_id: "org-2",
        message: "Bug: invoice total is wrong",
        category: "bug",
        page_path: "/dashboard/invoicing",
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "submit-beta-feedback",
        {
          body: {
            organization_id: "org-2",
            message: "Bug: invoice total is wrong",
            category: "bug",
            page_path: "/dashboard/invoicing",
          },
        },
      );
    });

    it("should omit category and page_path when not provided", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await submitBetaFeedback({
        organization_id: "org-3",
        message: "Just a general thought",
      });

      const call = vi.mocked(supabase.functions.invoke).mock.calls[0];
      const body = call[1]?.body as Record<string, unknown>;
      expect(body).not.toHaveProperty("category");
      expect(body).not.toHaveProperty("page_path");
      expect(body.organization_id).toBe("org-3");
      expect(body.message).toBe("Just a general thought");
    });

    it("should throw EdgeFunctionError when invoke returns error", async () => {
      const mockError = { message: "Forbidden", status: 403 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        submitBetaFeedback({
          organization_id: "org-1",
          message: "Feedback",
        }),
      ).rejects.toBeInstanceOf(EdgeFunctionError);

      await expect(
        submitBetaFeedback({
          organization_id: "org-1",
          message: "Feedback",
        }),
      ).rejects.toThrow("Forbidden");
    });
  });
});
