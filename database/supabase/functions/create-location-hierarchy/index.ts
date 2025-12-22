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
    functionName: "create-location-hierarchy",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "name",
      "type",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for location hierarchy creation", {
        missingFields: validation.missingFields,
      });
      return errorResponse(
        `Missing required fields: ${validation.missingFields?.join(", ")}`,
        400,
      );
    }

    const { organization_id, name, type, parent_id, metadata } = body;

    // Validate type (only company and region allowed - sites are now locations)
    const validTypes = ["company", "region"];
    if (!validTypes.includes(type)) {
      logger.warn("Invalid type provided for location hierarchy", { type });
      return errorResponse(
        `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        400,
      );
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to create location hierarchy", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // If parent_id is provided, verify it exists and belongs to the same organization
    if (parent_id) {
      const { data: parentNode, error: parentError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id, type")
        .eq("id", parent_id)
        .single();

      if (parentError || !parentNode) {
        return errorResponse("Parent node not found", 404);
      }

      if (parentNode.organization_id !== organization_id) {
        return errorResponse(
          "Parent node belongs to a different organization",
          400,
        );
      }

      // Validate hierarchy: only company -> region is allowed
      // Regions must have a company parent
      if (type === "region" && parentNode.type !== "company") {
        return errorResponse(
          "Regions can only be children of companies",
          400,
        );
      }

      // Companies cannot have parents
      if (type === "company" && parent_id) {
        return errorResponse(
          "Companies cannot have parent nodes",
          400,
        );
      }
    }

    const { data: node, error: insertError } = await supabase
      .from("location_hierarchy")
      .insert({
        organization_id,
        name,
        type,
        parent_id: parent_id || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Error creating location hierarchy node", insertError, {
        organization_id,
        name,
        type,
      });
      throw insertError;
    }

    logger.info("Location hierarchy node created successfully", {
      node_id: node?.id,
      organization_id,
      name,
      type,
    });

    return jsonResponse({
      success: true,
      node,
    });
  } catch (error) {
    logger.error("Create location hierarchy error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to create location hierarchy node"),
      getErrorStatusCode(error),
    );
  }
});
