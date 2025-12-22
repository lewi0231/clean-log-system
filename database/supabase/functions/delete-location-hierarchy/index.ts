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
    functionName: "delete-location-hierarchy",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for location hierarchy deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Node ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch node to get organization_id and verify it exists
    const { data: existingNode, error: fetchError } = await supabase
      .from("location_hierarchy")
      .select("id, organization_id, name")
      .eq("id", id)
      .single();

    if (fetchError || !existingNode) {
      logger.warn("Location hierarchy node not found for deletion", {
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
      logger.warn("Unauthorized attempt to delete location hierarchy", {
        node_id: id,
        organization_id: existingNode.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this location hierarchy node",
        403,
      );
    }

    // Check if node has children
    const { data: children, error: childrenError } = await supabase
      .from("location_hierarchy")
      .select("id")
      .eq("parent_id", id)
      .limit(1);

    if (childrenError) {
      logger.error("Error checking for child nodes", childrenError, {
        node_id: id,
      });
      throw childrenError;
    }

    if (children && children.length > 0) {
      logger.warn("Attempt to delete node with children", {
        node_id: id,
        child_count: children.length,
      });
      return errorResponse(
        "Cannot delete node with children. Delete child nodes first.",
        400,
      );
    }

    // Check if node has pricing rules
    const { data: pricingRules, error: pricingError } = await supabase
      .from("pricing_rule")
      .select("id")
      .eq("location_hierarchy_id", id)
      .limit(1);

    if (pricingError) {
      logger.error("Error checking for pricing rules", pricingError, {
        node_id: id,
      });
      throw pricingError;
    }

    if (pricingRules && pricingRules.length > 0) {
      logger.warn("Attempt to delete node with associated pricing rules", {
        node_id: id,
        pricing_rule_count: pricingRules.length,
      });
      return errorResponse(
        "Cannot delete node with associated pricing rules. Remove pricing rules first.",
        400,
      );
    }

    const { error: deleteError } = await supabase
      .from("location_hierarchy")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting location hierarchy node", deleteError, {
        node_id: id,
        organization_id: existingNode.organization_id,
      });
      throw deleteError;
    }

    logger.info("Location hierarchy node deleted successfully", {
      node_id: id,
      organization_id: existingNode.organization_id,
      node_name: existingNode.name,
    });

    return jsonResponse({
      success: true,
      message: "Location hierarchy node deleted successfully",
    });
  } catch (error) {
    logger.error("Delete location hierarchy error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete location hierarchy node"),
      getErrorStatusCode(error),
    );
  }
});
