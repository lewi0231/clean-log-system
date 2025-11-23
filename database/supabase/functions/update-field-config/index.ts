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
      label,
      field_type,
      description,
      required,
      order_position,
      validation_rules,
      options,
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
    if (label !== undefined) updateData.label = label;
    if (field_type !== undefined) updateData.field_type = field_type;
    if (description !== undefined) updateData.description = description;
    if (required !== undefined) updateData.required = required;
    if (order_position !== undefined)
      updateData.order_position = order_position;
    if (validation_rules !== undefined)
      updateData.validation_rules = validation_rules;
    if (options !== undefined) updateData.options = options;

    const { data: fieldConfig, error: updateError } = await supabase
      .from("organization_field_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

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
    console.error("Update field config error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update field config";
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
