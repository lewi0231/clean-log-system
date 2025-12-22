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

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "reorder-field-configs" });

  try {
    const body = await req.json();
    const { organization_id, field_config_ids } = body;

    if (!organization_id || !Array.isArray(field_config_ids)) {
      logger.warn("Missing required fields for field config reordering", {
        has_organization_id: !!organization_id,
        is_array: Array.isArray(field_config_ids),
      });
      return errorResponse(
        "Organization ID and field_config_ids array are required",
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
      logger.warn("Unauthorized attempt to reorder field configs", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Update order_position for each field config based on array index
    const updates = field_config_ids.map((id: string, index: number) =>
      supabase
        .from("organization_field_configs")
        .update({
          order_position: index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", organization_id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((result) => result.error);

    if (errors.length > 0) {
      logger.error("Error updating field config order", errors[0].error, {
        organization_id,
        field_config_count: field_config_ids.length,
        error_count: errors.length,
      });
      throw new Error(
        `Failed to update some field configs: ${errors[0].error?.message}`,
      );
    }

    logger.info("Field configs reordered successfully", {
      organization_id,
      field_config_count: field_config_ids.length,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Reorder field configs error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to reorder field configs"),
      getErrorStatusCode(error),
    );
  }
});
