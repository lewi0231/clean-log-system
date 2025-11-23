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
      label,
      field_type,
      description,
      required,
      order_position,
      validation_rules,
      options,
    } = await req.json();

    if (!organization_id || !name || !label || !field_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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
        active: true,
      })
      .select()
      .single();

    if (createError) throw createError;

    return new Response(
      JSON.stringify({
        success: true,
        field_config: fieldConfig,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Create field config error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create field config";
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
