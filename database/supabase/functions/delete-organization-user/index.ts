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
    functionName: "delete-organization-user",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for organization user deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Organization user ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Check how many admins exist for this organization
    const { data: userToDelete, error: fetchError } = await supabase
      .from("organization_user")
      .select("organization_id, role")
      .eq("id", id)
      .single();

    if (fetchError || !userToDelete) {
      logger.warn("Organization user not found for deletion", fetchError, {
        organization_user_id: id,
      });
      return errorResponse("Organization user not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      userToDelete.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete organization user", {
        organization_user_id: id,
        organization_id: userToDelete.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this organization user",
        403,
      );
    }

    if (userToDelete.role === "admin") {
      const { data: admins, error: countError } = await supabase
        .from("organization_user")
        .select("id")
        .eq("organization_id", userToDelete.organization_id)
        .eq("role", "admin");

      if (countError) {
        logger.error("Error counting admin users", countError, {
          organization_id: userToDelete.organization_id,
        });
        throw countError;
      }

      if (admins && admins.length <= 1) {
        logger.warn("Attempt to delete last admin user", {
          organization_user_id: id,
          organization_id: userToDelete.organization_id,
        });
        return errorResponse(
          "Cannot delete the last admin user. Please assign another admin first.",
          400,
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("organization_user")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting organization user", deleteError, {
        organization_user_id: id,
        organization_id: userToDelete.organization_id,
      });
      throw deleteError;
    }

    logger.info("Organization user deleted successfully", {
      organization_user_id: id,
      organization_id: userToDelete.organization_id,
      role: userToDelete.role,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Delete organization user error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete organization user"),
      getErrorStatusCode(error),
    );
  }
});
