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

    const { organization_id, location_id } = body;

    const supabase = createServiceRoleClient();

    const { data: fieldConfigs, error: fieldConfigsError } = await supabase
      .from("organization_field_configs")
      .select("*, location_field_config(location_id)")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .order("order_position", { ascending: true });

    if (fieldConfigsError) throw fieldConfigsError;

    const filtered = (fieldConfigs || []).filter((config) => {
      const locLinks = (config as typeof config & {
        location_field_config?: { location_id: string }[] | null;
      }).location_field_config || [];

      // If no restrictions, it's available everywhere
      if (!location_id || locLinks.length === 0) return true;

      // Allow if explicitly linked to the requested location
      return locLinks.some((link) => link.location_id === location_id);
    });

    const sanitized = filtered.map((config) => {
      const { location_field_config, ...rest } = config as Record<
        string,
        unknown
      >;
      return rest;
    });

    return jsonResponse({
      success: true,
      field_configs: sanitized,
    });
  } catch (error) {
    console.error("List field configs error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list field configs",
    );
  }
});
