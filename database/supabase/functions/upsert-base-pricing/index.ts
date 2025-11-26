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
      job_type_field_config_id,
      job_type_value,
      standalone_base_price,
      customer_base_price,
      worker_base_payment,
      location_id,
      currency,
    } = await req.json();

    if (!organization_id || customer_base_price === undefined) {
      return new Response(
        JSON.stringify({
          error: "Organization ID and customer base price are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate that only one pricing type is specified
    if (
      (job_type_field_config_id && standalone_base_price !== undefined) ||
      (!job_type_field_config_id && standalone_base_price === undefined)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Must specify either job_type_field_config_id (field-based) or standalone_base_price (standalone), but not both",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (customer_base_price < 0) {
      return new Response(
        JSON.stringify({ error: "Customer base price must be non-negative" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      worker_base_payment !== undefined &&
      worker_base_payment !== null &&
      worker_base_payment < 0
    ) {
      return new Response(
        JSON.stringify({
          error: "Worker base payment must be non-negative",
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

    // Verify field config exists if field-based
    if (job_type_field_config_id) {
      const { data: fieldConfig, error: fieldConfigError } = await supabase
        .from("organization_field_configs")
        .select("id, field_type, organization_id, options")
        .eq("id", job_type_field_config_id)
        .eq("organization_id", organization_id)
        .single();

      if (fieldConfigError || !fieldConfig) {
        return new Response(
          JSON.stringify({ error: "Field config not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (fieldConfig.field_type !== "select") {
        return new Response(
          JSON.stringify({
            error: "Field-based base pricing can only use select fields",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify job_type_value exists in field config options
      const options = fieldConfig.options as string[] | null;
      if (!options || !options.includes(job_type_value)) {
        return new Response(
          JSON.stringify({
            error: `Job type value "${job_type_value}" not found in field config options`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
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
      .from("base_pricing")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("job_type_field_config_id", job_type_field_config_id || null)
      .eq("job_type_value", job_type_value || "")
      .eq("location_id", location_id || null)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const upsertData: Record<string, unknown> = {
      organization_id,
      customer_base_price: parseFloat(customer_base_price),
      currency: currency || "USD",
      updated_at: new Date().toISOString(),
    };

    if (job_type_field_config_id) {
      upsertData.job_type_field_config_id = job_type_field_config_id;
      upsertData.job_type_value = job_type_value;
      upsertData.standalone_base_price = null;
    } else {
      upsertData.job_type_field_config_id = null;
      upsertData.job_type_value = job_type_value || "Default";
      upsertData.standalone_base_price = parseFloat(standalone_base_price);
    }

    if (location_id) {
      upsertData.location_id = location_id;
    }

    if (worker_base_payment !== undefined && worker_base_payment !== null) {
      upsertData.worker_base_payment = parseFloat(worker_base_payment);
    }

    let basePricing;
    if (existingPricing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from("base_pricing")
        .update(upsertData)
        .eq("id", existingPricing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      basePricing = updated;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("base_pricing")
        .insert(upsertData)
        .select()
        .single();
      if (insertError) throw insertError;
      basePricing = inserted;
    }

    return new Response(
      JSON.stringify({
        success: true,
        base_pricing: basePricing,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Upsert base pricing error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upsert base pricing";
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
