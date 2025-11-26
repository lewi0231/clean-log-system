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
    } = await req.json();

    if (
      !organization_id ||
      !name ||
      !rule_type ||
      !condition_field_config_id ||
      !condition_operator ||
      condition_value === undefined ||
      !action_type ||
      action_value === undefined
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify field config exists
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, organization_id")
      .eq("id", condition_field_config_id)
      .eq("organization_id", organization_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      return new Response(JSON.stringify({ error: "Field config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ error: "Location not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    console.error("Create pricing rule error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create pricing rule";
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
