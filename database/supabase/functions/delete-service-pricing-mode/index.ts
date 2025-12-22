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

  const logger = createLogger(req, {
    functionName: "delete-service-pricing-mode",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for service pricing mode deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch service pricing mode to get organization_id and verify it exists
    const { data: existingMode, error: fetchError } = await supabase
      .from("service_pricing_mode")
      .select(
        "id, organization_id, service_type_field_config_id, service_type_value",
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingMode) {
      logger.warn("Service pricing mode not found for deletion", {
        error: fetchError,
        mode_id: id,
      });
      return errorResponse("Service pricing mode not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingMode.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete service pricing mode", {
        mode_id: id,
        organization_id: existingMode.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this service pricing mode",
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("service_pricing_mode")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting service pricing mode", deleteError, {
        mode_id: id,
        organization_id: existingMode.organization_id,
      });
      throw deleteError;
    }

    logger.info("Service pricing mode deleted successfully", {
      mode_id: id,
      organization_id: existingMode.organization_id,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Delete service pricing mode error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete service pricing mode"),
      getErrorStatusCode(error),
    );
  }
});
