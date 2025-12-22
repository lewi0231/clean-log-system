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

  const logger = createLogger(req, { functionName: "create-field-config" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "name",
      "label",
      "field_type",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for field config creation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const {
      organization_id,
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

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to create field config", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Validate group/cluster consistency
    if (group_cluster && !mutually_exclusive_group) {
      logger.warn("Invalid group/cluster configuration", {
        organization_id,
        has_group_cluster: !!group_cluster,
        has_mutually_exclusive_group: !!mutually_exclusive_group,
      });
      return errorResponse(
        "Group cluster requires a mutually exclusive group to be set",
        400,
      );
    }

    // If order_position not provided, get the max and add 1
    let finalOrderPosition = order_position;
    if (finalOrderPosition === undefined || finalOrderPosition === null) {
      const { data: existingConfigs } = await supabase
        .from("organization_field_configs")
        .select("order_position")
        .eq("organization_id", organization_id)
        .eq("active", true)
        .order("order_position", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalOrderPosition = existingConfigs?.order_position
        ? existingConfigs.order_position + 1
        : 0;
    }

    const { data: fieldConfig, error: createError } = await supabase
      .from("organization_field_configs")
      .insert({
        organization_id,
        name,
        label,
        field_type,
        description: description || null,
        required: required || false,
        order_position: finalOrderPosition,
        validation_rules: validation_rules || null,
        options: options || null,
        mutually_exclusive_group: mutually_exclusive_group || null,
        group_cluster: group_cluster || null,
        section_id: section_id || null,
        conditional_logic: conditional_logic || null,
        active: true,
      })
      .select()
      .single();

    if (createError) {
      logger.error("Error creating field config", createError, {
        organization_id,
        name,
        field_type,
      });
      throw createError;
    }

    logger.info("Field config created successfully", {
      field_config_id: fieldConfig?.id,
      organization_id,
      name,
      field_type,
    });

    return jsonResponse({
      success: true,
      field_config: fieldConfig,
    });
  } catch (error) {
    logger.error("Create field config error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to create field config"),
      getErrorStatusCode(error),
    );
  }
});
