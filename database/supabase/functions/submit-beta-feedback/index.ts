import { serve } from "server";
import {
  getOrganizationUserByEmail,
  verifyOrganizationMembershipFromRequest,
} from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  uuidSchema,
  validateRequest,
} from "../_utils/zod-schemas.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Beta feedback category schema
 */
const betaFeedbackCategorySchema = z.enum(["bug", "idea", "general"]);

/**
 * Schema for submitting beta feedback
 */
const submitBetaFeedbackSchema = z.object({
  organization_id: uuidSchema,
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message must be 5000 characters or less"),
  category: betaFeedbackCategorySchema.optional().default("general"),
  page_path: z.string().max(500).optional(),
});

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "submit-beta-feedback" });

  try {
    const body = await req.json();
    const validation = validateRequest(submitBetaFeedbackSchema, body);

    if (!validation.success) {
      logger.warn("Validation failed", { error: validation.error });
      return errorResponse(validation.error, 400);
    }

    const { organization_id, message, category, page_path } = validation.data;

    const pagePath = page_path ?? null;

    const supabase = createServiceRoleClient();

    const membership = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
      body,
    );

    if (!membership) {
      logger.warn("Unauthorized beta feedback attempt", { organization_id });
      return errorResponse(
        "You do not have permission to submit feedback for this organization",
        403,
      );
    }

    let organizationUserId: string | null = null;
    if (membership.userEmail) {
      const orgUser = await getOrganizationUserByEmail(
        supabase,
        membership.userEmail,
      );
      if (orgUser && orgUser.organization_id === organization_id) {
        organizationUserId = orgUser.id;
      }
    }

    const { data: row, error: insertError } = await supabase
      .from("product_feedback")
      .insert({
        organization_id,
        user_id: organizationUserId,
        page_path: pagePath,
        category,
        message: message.trim(),
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      logger.error("Insert product_feedback failed", insertError, {
        organization_id,
      });
      return errorResponse(
        insertError.message ?? "Failed to save feedback",
        500,
      );
    }

    logger.info("Beta feedback submitted", {
      id: row?.id,
      organization_id,
      category,
    });

    return jsonResponse({
      success: true,
      id: row?.id,
      created_at: row?.created_at,
    });
  } catch (error) {
    logger.error("Submit beta feedback error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to submit feedback"),
      getErrorStatusCode(error),
    );
  }
});
