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

  const logger = createLogger(req, { functionName: "update-form-section" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for form section update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const { id, title, description, order_position, collapsed_by_default } =
      body;

    const supabase = createServiceRoleClient();

    // Fetch form section to get organization_id and verify it exists
    const { data: existingSection, error: fetchError } = await supabase
      .from("form_section")
      .select("id, organization_id, title")
      .eq("id", id)
      .single();

    if (fetchError || !existingSection) {
      logger.warn("Form section not found for update", {
        error: fetchError,
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
      logger.warn("Unauthorized attempt to update form section", {
        section_id: id,
        organization_id: existingSection.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this form section",
        403,
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order_position !== undefined) {
      updateData.order_position = order_position;
    }
    if (collapsed_by_default !== undefined) {
      updateData.collapsed_by_default = collapsed_by_default;
    }

    const { data: section, error: updateError } = await supabase
      .from("form_section")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating form section", updateError, {
        section_id: id,
        organization_id: existingSection.organization_id,
      });
      throw updateError;
    }

    logger.info("Form section updated successfully", {
      section_id: id,
      organization_id: existingSection.organization_id,
    });

    return jsonResponse({
      success: true,
      section,
    });
  } catch (error) {
    logger.error("Update form section error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update form section"),
      getErrorStatusCode(error),
    );
  }
});
