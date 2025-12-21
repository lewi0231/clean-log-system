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

  const logger = createLogger(req, { functionName: "delete-location" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for location deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Location ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch location to get organization_id and verify it exists
    const { data: location, error: fetchError } = await supabase
      .from("location")
      .select("id, organization_id, name")
      .eq("id", id)
      .single();

    if (fetchError || !location) {
      logger.warn("Location not found for deletion", fetchError, {
        location_id: id,
      });
      return errorResponse("Location not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      location.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete location", {
        location_id: id,
        organization_id: location.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this location",
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("location")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting location", deleteError, {
        location_id: id,
        organization_id: location.organization_id,
      });
      throw deleteError;
    }

    logger.info("Location deleted successfully", {
      location_id: id,
      organization_id: location.organization_id,
      location_name: location.name,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Delete location error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete location"),
      getErrorStatusCode(error),
    );
  }
});
