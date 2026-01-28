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
import { validateRequiredFields } from "../_utils/validation.ts";

const VALID_CATEGORIES = ["bug", "idea", "general"] as const;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "submit-beta-feedback" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "message",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields", {
        missingFields: validation.missingFields,
      });
      return errorResponse(
        `Missing required fields: ${validation.missingFields?.join(", ") ?? "organization_id, message"}`,
        400,
      );
    }

    const {
      organization_id,
      message,
      category: rawCategory,
      page_path,
    } = body;

    const category =
      typeof rawCategory === "string" && VALID_CATEGORIES.includes(rawCategory)
        ? rawCategory
        : "general";

    if (typeof message !== "string" || message.trim().length === 0) {
      return errorResponse("Message cannot be empty", 400);
    }

    if (message.length > 5000) {
      return errorResponse("Message must be 5000 characters or less", 400);
    }

    const pagePath =
      typeof page_path === "string" && page_path.length > 0
        ? page_path.slice(0, 500)
        : null;

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
