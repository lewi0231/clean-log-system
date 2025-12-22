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

  const logger = createLogger(req, { functionName: "delete-base-pricing" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for base pricing deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch base pricing to get organization_id and verify it exists
    const { data: existingPricing, error: fetchError } = await supabase
      .from("base_pricing")
      .select("id, organization_id, job_type_field_config_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingPricing) {
      logger.warn("Base pricing not found for deletion", fetchError, {
        pricing_id: id,
      });
      return errorResponse("Base pricing not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingPricing.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete base pricing", {
        pricing_id: id,
        organization_id: existingPricing.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this base pricing",
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("base_pricing")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting base pricing", deleteError, {
        pricing_id: id,
        organization_id: existingPricing.organization_id,
      });
      throw deleteError;
    }

    logger.info("Base pricing deleted successfully", {
      pricing_id: id,
      organization_id: existingPricing.organization_id,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Delete base pricing error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete base pricing"),
      getErrorStatusCode(error),
    );
  }
});
