import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "list-option-pricing" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, field_config_id, location_id } = body;

    const supabase = createServiceRoleClient();

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

    return jsonResponse({
      success: true,
      option_pricing: optionPricing || [],
    });
  } catch (error) {
    logger.error("List option pricing error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list option pricing"
    );
  }
});
