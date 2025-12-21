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

  const logger = createLogger(req, { functionName: "update-field-config" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for field config update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("ID is required", 400);
    }

    const {
      id,
      name,
      label,
      field_type,
      description,
      required,
      order_position,
      validation_rules,
      options,
      mutually_exclusive_group,
      group_cluster,
      section_id,
      conditional_logic,
    } = body;

    const supabase = createServiceRoleClient();

    // Fetch field config to get organization_id and verify it exists
    const { data: existingFieldConfig, error: fetchError } = await supabase
      .from("organization_field_configs")
      .select("id, organization_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingFieldConfig) {
      logger.warn("Field config not found for update", fetchError, {
        field_config_id: id,
      });
      return errorResponse("Field config not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingFieldConfig.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to update field config", {
        field_config_id: id,
        organization_id: existingFieldConfig.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this field config",
        403,
      );
    }

    // Validate group/cluster consistency
    // Only validate if group_cluster is being set to a non-null value
    // Allow both to be null when clearing them
    if (
      group_cluster !== undefined &&
      group_cluster !== null &&
      (!mutually_exclusive_group || mutually_exclusive_group === null)
    ) {
      logger.warn("Invalid group/cluster configuration", {
        field_config_id: id,
        has_group_cluster: !!group_cluster,
        has_mutually_exclusive_group: !!mutually_exclusive_group,
      });
      return errorResponse(
        "Group cluster requires a mutually exclusive group to be set",
        400,
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (label !== undefined) updateData.label = label;
    if (field_type !== undefined) updateData.field_type = field_type;
    if (description !== undefined) updateData.description = description;
    if (required !== undefined) updateData.required = required;
    if (order_position !== undefined) {
      updateData.order_position = order_position;
    }
    if (validation_rules !== undefined) {
      updateData.validation_rules = validation_rules;
    }
    if (options !== undefined) updateData.options = options;
    if (mutually_exclusive_group !== undefined) {
      updateData.mutually_exclusive_group = mutually_exclusive_group || null;
    }
    if (group_cluster !== undefined) {
      updateData.group_cluster = group_cluster || null;
    }
    if (section_id !== undefined) updateData.section_id = section_id || null;
    if (conditional_logic !== undefined) {
      updateData.conditional_logic = conditional_logic || null;
    }

    const { data: fieldConfig, error: updateError } = await supabase
      .from("organization_field_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating field config", updateError, {
        field_config_id: id,
        organization_id: existingFieldConfig.organization_id,
      });
      throw updateError;
    }

    logger.info("Field config updated successfully", {
      field_config_id: id,
      organization_id: existingFieldConfig.organization_id,
    });

    return jsonResponse({
      success: true,
      field_config: fieldConfig,
    });
  } catch (error) {
    logger.error("Update field config error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update field config"),
      getErrorStatusCode(error),
    );
  }
});
