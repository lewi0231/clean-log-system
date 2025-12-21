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

  const logger = createLogger(req, { functionName: "update-location" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "id",
      "name",
      "email",
      "address",
      "contact_person",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for location update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const {
      id,
      name,
      email,
      address,
      contact_person,
      phone,
      hierarchy_parent_id,
    } = body;

    const supabase = createServiceRoleClient();

    // First get the location to check organization_id and verify membership
    const { data: existingLocation, error: existingError } = await supabase
      .from("location")
      .select("organization_id")
      .eq("id", id)
      .single();

    if (existingError || !existingLocation) {
      logger.warn("Location not found for update", existingError, {
        location_id: id,
      });
      return errorResponse("Location not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingLocation.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to update location", {
        location_id: id,
        organization_id: existingLocation.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this location",
        403,
      );
    }

    // Validate hierarchy_parent_id if provided
    if (hierarchy_parent_id) {
      const { data: parentNode, error: parentError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id")
        .eq("id", hierarchy_parent_id)
        .single();

      if (parentError || !parentNode) {
        return errorResponse("Invalid hierarchy parent", 400);
      }

      if (parentNode.organization_id !== existingLocation.organization_id) {
        logger.warn("Hierarchy parent belongs to different organization", {
          location_id: id,
          hierarchy_parent_id,
          location_org_id: existingLocation.organization_id,
          parent_org_id: parentNode.organization_id,
        });
        return errorResponse(
          "Hierarchy parent belongs to a different organization",
          400,
        );
      }
    }

    const { data: location, error: locationError } = await supabase
      .from("location")
      .update({
        name,
        email,
        address,
        contact_person,
        phone: phone || null,
        hierarchy_parent_id: hierarchy_parent_id ?? null,
      })
      .eq("id", id)
      .select(`
        *,
        hierarchy_parent:hierarchy_parent_id (
          id,
          name,
          type
        )
      `)
      .single();

    if (locationError) {
      logger.error("Error updating location", locationError, {
        location_id: id,
        organization_id: existingLocation.organization_id,
      });
      throw locationError;
    }

    logger.info("Location updated successfully", {
      location_id: id,
      organization_id: existingLocation.organization_id,
    });

    return jsonResponse({ success: true, location });
  } catch (error) {
    logger.error("Update location error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update location"),
      getErrorStatusCode(error),
    );
  }
});
