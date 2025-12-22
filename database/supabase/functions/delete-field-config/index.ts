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

  const logger = createLogger(req, { functionName: "delete-field-config" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for field config deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch field config to get organization_id and verify it exists
    const { data: fieldConfig, error: fetchError } = await supabase
      .from("organization_field_configs")
      .select("id, organization_id, name")
      .eq("id", id)
      .single();

    if (fetchError || !fieldConfig) {
      logger.warn("Field config not found for deletion", {
        field_config_id: id,
        error: fetchError,
      });
      return errorResponse("Field config not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      fieldConfig.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete field config", {
        field_config_id: id,
        organization_id: fieldConfig.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this field config",
        403,
      );
    }

    // Check if field config is used in any jobs (data loss warning)
    const { data: jobsUsingField, error: jobsError } = await supabase
      .from("job")
      .select("id")
      .eq("organization_id", fieldConfig.organization_id)
      .not("submission_data", "is", null)
      .limit(1);

    if (jobsError) {
      logger.error("Error checking field config usage in jobs", jobsError, {
        field_config_id: id,
      });
      // Continue with deletion even if check fails
    }

    const hasData = jobsUsingField && jobsUsingField.length > 0;

    // Hard delete - note: This permanently removes the field config and all associated data
    // Future enhancement: Consider soft delete (archive) or require explicit confirmation
    logger.info("Deleting field config", {
      field_config_id: id,
      field_config_name: fieldConfig.name,
      organization_id: fieldConfig.organization_id,
      has_associated_data: hasData,
      warning: hasData
        ? "This deletion will affect existing job data that references this field"
        : undefined,
    });

    const { error: deleteError } = await supabase
      .from("organization_field_configs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting field config", deleteError, {
        field_config_id: id,
        organization_id: fieldConfig.organization_id,
      });
      throw deleteError;
    }

    logger.info("Field config deleted successfully", {
      field_config_id: id,
      organization_id: fieldConfig.organization_id,
    });

    return jsonResponse({
      success: true,
      message: "Field config deleted successfully",
      warning: hasData
        ? "Note: This field config was referenced in existing job data. Historical data may be affected."
        : undefined,
    });
  } catch (error) {
    logger.error("Delete field config error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete field config"),
      getErrorStatusCode(error),
    );
  }
});
