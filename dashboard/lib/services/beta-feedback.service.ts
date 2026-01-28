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
 * Submit in-app product/beta feedback (bugs, ideas, general).
 * Requires authenticated user with org membership.
 */
export async function submitBetaFeedback(
  params: SubmitBetaFeedbackParams,
): Promise<SubmitBetaFeedbackResponse> {
  const body: Record<string, unknown> = {
    organization_id: params.organization_id,
    message: params.message,
  };
  if (params.category) body.category = params.category;
  if (params.page_path) body.page_path = params.page_path;

  return invokeEdgeFunction<SubmitBetaFeedbackResponse>(
    "submit-beta-feedback",
    body,
  );
}
