import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  validateNonNegativeNumber,
  validateRequiredFields,
} from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "field_config_id",
    ]);

    if (!validation.valid || body.customer_price === undefined) {
      return errorResponse(
        "Organization ID, field config ID, and customer price are required",
        400
      );
    }

    const {
      organization_id,
      field_config_id,
      customer_price,
      currency,
      location_id,
      pricing_type,
      applies_to_field_type,
      worker_payment_type,
      worker_payment_value,
    } = body;

    if (!validateNonNegativeNumber(customer_price)) {
      return errorResponse("Customer price must be non-negative", 400);
    }

    // Validate worker payment value if provided
    if (
      worker_payment_type === "percentage" &&
      worker_payment_value !== undefined
    ) {
      if (
        !validateNonNegativeNumber(worker_payment_value) ||
        worker_payment_value > 100
      ) {
        return errorResponse(
          "Worker payment percentage must be between 0 and 100",
          400
        );
      }
    }

    if (
      worker_payment_type === "fixed_rate" &&
      worker_payment_value !== undefined &&
      !validateNonNegativeNumber(worker_payment_value)
    ) {
      return errorResponse(
        "Worker payment fixed rate must be non-negative",
        400
      );
    }

    const supabase = createServiceRoleClient();

    // Verify field config exists
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, field_type, organization_id")
      .eq("id", field_config_id)
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

    // Set applies_to_field_type from field config if not provided
    const finalAppliesToFieldType =
      applies_to_field_type || fieldConfig.field_type;

    // Build upsert data
    const upsertData: Record<string, unknown> = {
      organization_id,
      field_config_id,
      customer_price: customer_price,
      currency: currency || "USD",
      pricing_type: pricing_type || "unit",
      applies_to_field_type: finalAppliesToFieldType,
      updated_at: new Date().toISOString(),
    };

    if (location_id) {
      upsertData.location_id = location_id;
    }

    if (worker_payment_type) {
      upsertData.worker_payment_type = worker_payment_type;
      if (worker_payment_value !== undefined) {
        upsertData.worker_payment_value = parseFloat(worker_payment_value);
      }
    }

    // Check if pricing exists for this combination
    const { data: existingPricing, error: checkError } = await supabase
      .from("field_pricing")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("field_config_id", field_config_id)
      .eq("location_id", location_id || null)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    let fieldPricing;
    if (existingPricing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from("field_pricing")
        .update(upsertData)
        .eq("id", existingPricing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      fieldPricing = updated;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("field_pricing")
        .insert(upsertData)
        .select()
        .single();
      if (insertError) throw insertError;
      fieldPricing = inserted;
    }

    return jsonResponse({
      success: true,
      field_pricing: fieldPricing,
    });
  } catch (error) {
    console.error("Upsert field pricing error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to upsert field pricing"
    );
  }
});
