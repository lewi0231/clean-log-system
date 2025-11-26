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
      field_config_id,
      option_value,
      customer_price,
      worker_payment_rate,
      location_id,
      currency,
    } = await req.json();

    if (
      !organization_id ||
      !field_config_id ||
      !option_value ||
      customer_price === undefined
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Organization ID, field config ID, option value, and customer price are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (customer_price < 0) {
      return new Response(
        JSON.stringify({ error: "Customer price must be non-negative" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (worker_payment_rate !== undefined && worker_payment_rate < 0) {
      return new Response(
        JSON.stringify({
          error: "Worker payment rate must be non-negative",
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

    // Verify field config exists and is select or grouped_breakdown
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, field_type, organization_id, options")
      .eq("id", field_config_id)
      .eq("organization_id", organization_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      return new Response(JSON.stringify({ error: "Field config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      fieldConfig.field_type !== "select" &&
      fieldConfig.field_type !== "grouped_breakdown"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Option pricing can only be set for select or grouped_breakdown fields",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify option_value exists in field config options
    const options = fieldConfig.options as string[] | null;
    if (!options || !options.includes(option_value)) {
      return new Response(
        JSON.stringify({
          error: `Option "${option_value}" not found in field config options`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    // Check if pricing exists for this combination
    const { data: existingPricing, error: checkError } = await supabase
      .from("option_pricing")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("field_config_id", field_config_id)
      .eq("option_value", option_value)
      .eq("location_id", location_id || null)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const upsertData: Record<string, unknown> = {
      organization_id,
      field_config_id,
      option_value,
      customer_price: parseFloat(customer_price),
      currency: currency || "USD",
      updated_at: new Date().toISOString(),
    };

    if (location_id) {
      upsertData.location_id = location_id;
    }

    if (worker_payment_rate !== undefined) {
      upsertData.worker_payment_rate = parseFloat(worker_payment_rate);
    }

    let optionPricing;
    if (existingPricing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from("option_pricing")
        .update(upsertData)
        .eq("id", existingPricing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      optionPricing = updated;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("option_pricing")
        .insert(upsertData)
        .select()
        .single();
      if (insertError) throw insertError;
      optionPricing = inserted;
    }

    return new Response(
      JSON.stringify({
        success: true,
        option_pricing: optionPricing,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Upsert option pricing error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to upsert option pricing";
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
