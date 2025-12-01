import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "name",
      "rule_type",
      "condition_field_config_id",
      "condition_operator",
      "action_type",
    ]);

    if (
      !validation.valid ||
      body.condition_value === undefined ||
      body.action_value === undefined
    ) {
      return errorResponse("Missing required fields", 400);
    }

    const {
      organization_id,
      name,
      description,
      rule_type,
      condition_field_config_id,
      condition_operator,
      condition_value,
      action_type,
      action_value,
      priority,
      enabled,
      location_id,
    } = body;

    const supabase = createServiceRoleClient();

    // Verify field config exists
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, organization_id")
      .eq("id", condition_field_config_id)
      .eq("organization_id", organization_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      return errorResponse("Field config not found", 404);
    }

    // Validate location_id if provided
    if (location_id) {
      const { data: location, error: locationError } = await supabase
        .from("location")
        .select("id, organization_id")
        .eq("id", location_id)
        .eq("organization_id", organization_id)
        .single();

      if (locationError || !location) {
        return errorResponse("Location not found", 404);
      }
    }

    const { data: pricingRule, error: createError } = await supabase
      .from("pricing_rules")
      .insert({
        organization_id,
        name,
        description: description || null,
        rule_type,
        condition_field_config_id,
        condition_operator,
        condition_value: String(condition_value),
        action_type,
        action_value: parseFloat(action_value),
        priority: priority || 0,
        enabled: enabled !== undefined ? enabled : true,
        location_id: location_id || null,
      })
      .select()
      .single();

    if (createError) throw createError;

    return jsonResponse({
      success: true,
      pricing_rule: pricingRule,
    });
  } catch (error) {
    console.error("Create pricing rule error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create pricing rule"
    );
  }
});
