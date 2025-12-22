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

  const logger = createLogger(req, { functionName: "delete-form-section" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for form section deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch form section to get organization_id and verify it exists
    const { data: existingSection, error: fetchError } = await supabase
      .from("form_section")
      .select("id, organization_id, title")
      .eq("id", id)
      .single();

    if (fetchError || !existingSection) {
      logger.warn("Form section not found for deletion", fetchError, {
        section_id: id,
      });
      return errorResponse("Form section not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingSection.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete form section", {
        section_id: id,
        organization_id: existingSection.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this form section",
        403,
      );
    }

    // First, clear section_id from any fields that reference this section
    const { error: clearError } = await supabase
      .from("organization_field_configs")
      .update({ section_id: null })
      .eq("section_id", id);

    if (clearError) {
      logger.error("Error clearing section_id from field configs", clearError, {
        section_id: id,
      });
      throw clearError;
    }

    // Then delete the section
    const { error: deleteError } = await supabase
      .from("form_section")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting form section", deleteError, {
        section_id: id,
        organization_id: existingSection.organization_id,
      });
      throw deleteError;
    }

    logger.info("Form section deleted successfully", {
      section_id: id,
      organization_id: existingSection.organization_id,
      section_title: existingSection.title,
    });

    return jsonResponse({
      success: true,
    });
  } catch (error) {
    logger.error("Delete form section error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete form section"),
      getErrorStatusCode(error),
    );
  }
});
