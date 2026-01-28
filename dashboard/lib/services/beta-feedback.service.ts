import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";

export type BetaFeedbackCategory = "bug" | "idea" | "general";

export interface SubmitBetaFeedbackParams {
  organization_id: string;
  message: string;
  category?: BetaFeedbackCategory;
  page_path?: string;
}

export interface SubmitBetaFeedbackResponse {
  success: boolean;
  id?: string;
  created_at?: string;
}

/**
 * Service for submitting in-app product/beta feedback.
 */
export class BetaFeedbackService {
  /**
   * Submit in-app product/beta feedback (bugs, ideas, general).
   * Requires authenticated user with org membership.
   */
  static async submit(
    params: SubmitBetaFeedbackParams,
  ): Promise<SubmitBetaFeedbackResponse> {
    try {
      log.debug("BetaFeedbackService: Submitting feedback", {
        organizationId: params.organization_id,
        category: params.category ?? "general",
        pagePath: params.page_path,
      });

      const body: Record<string, unknown> = {
        organization_id: params.organization_id,
        message: params.message,
      };
      if (params.category) body.category = params.category;
      if (params.page_path) body.page_path = params.page_path;

      const response = await invokeEdgeFunction<SubmitBetaFeedbackResponse>(
        "submit-beta-feedback",
        body,
      );

      log.info("BetaFeedbackService: Feedback submitted successfully", {
        id: response.id,
        organizationId: params.organization_id,
        category: params.category ?? "general",
      });

      return response;
    } catch (err) {
      log.error("BetaFeedbackService: Failed to submit feedback", {
        error: err instanceof Error ? err.message : "Unknown error",
        organizationId: params.organization_id,
      });
      throw err;
    }
  }
}

/**
 * Submit in-app product/beta feedback (bugs, ideas, general).
 * Requires authenticated user with org membership.
 * @deprecated Use BetaFeedbackService.submit() instead
 */
export async function submitBetaFeedback(
  params: SubmitBetaFeedbackParams,
): Promise<SubmitBetaFeedbackResponse> {
  return BetaFeedbackService.submit(params);
}
