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
    const { organization_id, field_config_id, location_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
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

    // Build query
    let query = supabase
      .from("option_pricing")
      .select(
        `
        *,
        field_config:field_config_id (
          id,
          name,
          label,
          field_type
        ),
        location:location_id (
          id,
          name
        )
      `
      )
      .eq("organization_id", organization_id);

    if (field_config_id) {
      query = query.eq("field_config_id", field_config_id);
    }

    if (location_id !== undefined) {
      if (location_id === null) {
        query = query.is("location_id", null);
      } else {
        query = query.eq("location_id", location_id);
      }
    }

    const { data: optionPricing, error: pricingError } = await query.order(
      "option_value",
      { ascending: true }
    );

    if (pricingError) throw pricingError;

    return new Response(
      JSON.stringify({
        success: true,
        option_pricing: optionPricing || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("List option pricing error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to list option pricing";
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
