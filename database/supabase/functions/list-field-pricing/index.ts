import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "list-field-pricing" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    // Get field pricing with field config details and location info
    const { data: fieldPricing, error: pricingError } = await supabase
      .from("field_pricing")
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
      .eq("organization_id", organization_id)
      .order("location_id", { ascending: true, nullsFirst: true });

    if (pricingError) throw pricingError;

    return jsonResponse({
      success: true,
      field_pricing: fieldPricing || [],
    });
  } catch (error) {
    logger.error("List field pricing error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list field pricing"
    );
  }
});
