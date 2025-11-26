import { createClient } from "@supabase/supabase-js";
import { serve } from "server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    return new Response(
      JSON.stringify({
        success: true,
        pricing_rule: pricingRule,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Update pricing rule error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update pricing rule";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
