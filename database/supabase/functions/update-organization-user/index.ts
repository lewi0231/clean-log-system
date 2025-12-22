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
import { validateRequiredFields, validateRole } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "update-organization-user",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for organization user update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Organization user ID is required", 400);
    }

    const { id, role } = body;

    const updateData: { role?: string } = {};

    if (role !== undefined) {
      // Validate role
      if (!validateRole(role)) {
        logger.warn("Invalid role provided", { role });
        return errorResponse("Invalid role. Must be 'admin' or 'viewer'", 400);
      }
      updateData.role = role;
    }

    if (Object.keys(updateData).length === 0) {
      logger.warn("No fields provided for organization user update", {
        organization_user_id: id,
      });
      return errorResponse("At least one field must be provided", 400);
    }

    const supabase = createServiceRoleClient();

    // Fetch organization user to get organization_id and verify it exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("organization_user")
      .select("id, organization_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingUser) {
      logger.warn("Organization user not found for update", {
        error: fetchError,
        organization_user_id: id,
      });
      return errorResponse("Organization user not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingUser.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to update organization user", {
        organization_user_id: id,
        organization_id: existingUser.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this organization user",
        403,
      );
    }

    const { data: organizationUser, error: updateError } = await supabase
      .from("organization_user")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating organization user", updateError, {
        organization_user_id: id,
        organization_id: existingUser.organization_id,
      });
      throw updateError;
    }

    logger.info("Organization user updated successfully", {
      organization_user_id: id,
      organization_id: existingUser.organization_id,
      new_role: role,
    });

    return jsonResponse({
      success: true,
      organization_user: organizationUser,
    });
  } catch (error) {
    logger.error("Update organization user error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update organization user"),
      getErrorStatusCode(error),
    );
  }
});
