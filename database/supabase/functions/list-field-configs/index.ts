import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "list-field-configs" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, location_id, include_location_restrictions } =
      body;

    const supabase = createServiceRoleClient();

    // Fetch field configs
    const { data: fieldConfigs, error: fieldConfigsError } = await supabase
      .from("organization_field_configs")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .order("order_position", { ascending: true });

    if (fieldConfigsError) throw fieldConfigsError;

    // Normalize location_id: treat empty string as null/undefined
    const normalizedLocationId = location_id && location_id.trim() !== "" ? location_id : null;

    // If location_id is provided, fetch location restrictions and filter
    let filtered = fieldConfigs || [];
    if (normalizedLocationId) {
      // Fetch all location restrictions for these field configs
      const fieldConfigIds = (fieldConfigs || []).map((fc) => fc.id);
      
      if (fieldConfigIds.length > 0) {
        const { data: locationRestrictions, error: restrictionsError } =
          await supabase
            .from("location_field_config")
            .select("field_config_id, location_id")
            .in("field_config_id", fieldConfigIds);

        if (restrictionsError) throw restrictionsError;

        // Create a map: field_config_id -> array of location_ids
        const restrictionsMap = new Map<string, string[]>();
        (locationRestrictions || []).forEach((restriction) => {
          const fieldId = restriction.field_config_id;
          if (!restrictionsMap.has(fieldId)) {
            restrictionsMap.set(fieldId, []);
          }
          restrictionsMap.get(fieldId)!.push(restriction.location_id);
        });

        // Filter fields based on location restrictions
        filtered = (fieldConfigs || []).filter((config) => {
          const restrictedLocations = restrictionsMap.get(config.id) || [];

          // If field has no restrictions, it's available everywhere
          if (restrictedLocations.length === 0) return true;

          // Field has restrictions - only show if location_id matches
          return restrictedLocations.includes(normalizedLocationId);
        });
      }
    }

    // If include_location_restrictions is requested, fetch restrictions for filtered configs
    let sanitized = filtered;
    if (include_location_restrictions) {
      const filteredConfigIds = filtered.map((fc) => fc.id);
      
      if (filteredConfigIds.length > 0) {
        const { data: locationRestrictions, error: restrictionsError } =
          await supabase
            .from("location_field_config")
            .select("field_config_id, location_id")
            .in("field_config_id", filteredConfigIds);

        if (restrictionsError) throw restrictionsError;

        // Create a map: field_config_id -> array of location_ids
        const restrictionsMap = new Map<string, string[]>();
        (locationRestrictions || []).forEach((restriction) => {
          const fieldId = restriction.field_config_id;
          if (!restrictionsMap.has(fieldId)) {
            restrictionsMap.set(fieldId, []);
          }
          restrictionsMap.get(fieldId)!.push(restriction.location_id);
        });

        // Add location_restrictions to each config
        sanitized = filtered.map((config) => {
          const restrictions = restrictionsMap.get(config.id) || [];
          return {
            ...config,
            location_restrictions: restrictions,
          };
        });
      }
    }

    return jsonResponse({
      success: true,
      field_configs: sanitized,
    });
  } catch (error) {
    logger.error("List field configs error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list field configs",
    );
  }
});
