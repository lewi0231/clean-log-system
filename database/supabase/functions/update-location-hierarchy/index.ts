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
    functionName: "update-location-hierarchy",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for location hierarchy update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Node ID is required", 400);
    }

    const { id, name, metadata } = body;

    const supabase = createServiceRoleClient();

    // Fetch node to get organization_id and verify it exists
    const { data: existingNode, error: fetchError } = await supabase
      .from("location_hierarchy")
      .select("id, organization_id, name")
      .eq("id", id)
      .single();

    if (fetchError || !existingNode) {
      logger.warn("Location hierarchy node not found for update", {
        error: fetchError,
        node_id: id,
      });
      return errorResponse("Location hierarchy node not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingNode.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to update location hierarchy", {
        node_id: id,
        organization_id: existingNode.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this location hierarchy node",
        403,
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (metadata !== undefined) updateData.metadata = metadata;

    if (Object.keys(updateData).length === 0) {
      logger.warn("No fields provided for location hierarchy update", {
        node_id: id,
      });
      return errorResponse("No fields to update", 400);
    }

    const { data: node, error: updateError } = await supabase
      .from("location_hierarchy")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating location hierarchy node", updateError, {
        node_id: id,
        organization_id: existingNode.organization_id,
      });
      throw updateError;
    }

    logger.info("Location hierarchy node updated successfully", {
      node_id: id,
      organization_id: existingNode.organization_id,
    });

    return jsonResponse({
      success: true,
      node,
    });
  } catch (error) {
    logger.error("Update location hierarchy error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update location hierarchy node"),
      getErrorStatusCode(error),
    );
  }
});
