import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    const { data: pricingRules, error: rulesError } = await supabase
      .from("pricing_rules")
      .select(
        `
        *,
        field_config:condition_field_config_id (
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
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (rulesError) throw rulesError;

    return jsonResponse({
      success: true,
      pricing_rules: pricingRules || [],
    });
  } catch (error) {
    console.error("List pricing rules error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list pricing rules"
    );
  }
});
