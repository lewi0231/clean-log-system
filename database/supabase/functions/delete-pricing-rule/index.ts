import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
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

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "delete-pricing-rule" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for pricing rule deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch pricing rule to get organization_id and verify it exists
    const { data: existingRule, error: fetchError } = await supabase
      .from("pricing_rule")
      .select("id, organization_id, scope, pricing_type")
      .eq("id", id)
      .single();

    if (fetchError || !existingRule) {
      logger.warn("Pricing rule not found for deletion", fetchError, {
        rule_id: id,
      });
      return errorResponse("Pricing rule not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingRule.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete pricing rule", {
        rule_id: id,
        organization_id: existingRule.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this pricing rule",
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("pricing_rule")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting pricing rule", deleteError, {
        rule_id: id,
        organization_id: existingRule.organization_id,
      });
      throw deleteError;
    }

    logger.info("Pricing rule deleted successfully", {
      rule_id: id,
      organization_id: existingRule.organization_id,
      scope: existingRule.scope,
      pricing_type: existingRule.pricing_type,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Delete pricing rule error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete pricing rule"),
      getErrorStatusCode(error),
    );
  }
});
