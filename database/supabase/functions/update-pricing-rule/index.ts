import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      return errorResponse("ID is required", 400);
    }

    const {
      id,
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

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (rule_type !== undefined) updateData.rule_type = rule_type;
    if (condition_field_config_id !== undefined)
      updateData.condition_field_config_id = condition_field_config_id;
    if (condition_operator !== undefined)
      updateData.condition_operator = condition_operator;
    if (condition_value !== undefined)
      updateData.condition_value = String(condition_value);
    if (action_type !== undefined) updateData.action_type = action_type;
    if (action_value !== undefined)
      updateData.action_value = parseFloat(action_value);
    if (priority !== undefined) updateData.priority = priority;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (location_id !== undefined) updateData.location_id = location_id || null;

    const { data: pricingRule, error: updateError } = await supabase
      .from("pricing_rules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      pricing_rule: pricingRule,
    });
  } catch (error) {
    console.error("Update pricing rule error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update pricing rule"
    );
  }
});
