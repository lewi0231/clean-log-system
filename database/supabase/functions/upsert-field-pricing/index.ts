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
    const { organization_id, field_config_id, unit_price, currency } =
      await req.json();

    if (!organization_id || !field_config_id || unit_price === undefined) {
      return new Response(
        JSON.stringify({
          error:
            "Organization ID, field config ID, and unit price are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (unit_price < 0) {
      return new Response(
        JSON.stringify({ error: "Unit price must be non-negative" }),
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

    // Verify field config exists and is a number type
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, field_type, organization_id")
      .eq("id", field_config_id)
      .eq("organization_id", organization_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      return new Response(JSON.stringify({ error: "Field config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (fieldConfig.field_type !== "number") {
      return new Response(
        JSON.stringify({
          error: "Pricing can only be set for number-type fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Upsert field pricing
    const { data: fieldPricing, error: upsertError } = await supabase
      .from("field_pricing")
      .upsert(
        {
          organization_id,
          field_config_id,
          unit_price: parseFloat(unit_price),
          currency: currency || "USD",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,field_config_id",
        }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        success: true,
        field_pricing: fieldPricing,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Upsert field pricing error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upsert field pricing";
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
