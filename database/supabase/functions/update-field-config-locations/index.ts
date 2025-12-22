import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "update-field-config-locations",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["field_config_id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for field config location update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Field config ID is required", 400);
    }

    const { field_config_id, location_ids } = body;

    // Validate location_ids is an array if provided
    if (location_ids !== undefined && !Array.isArray(location_ids)) {
      logger.warn("Invalid location_ids format", {
        field_config_id,
        location_ids_type: typeof location_ids,
      });
      return errorResponse("location_ids must be an array", 400);
    }

    const supabase = createServiceRoleClient();

    // First, verify the field config exists
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, organization_id")
      .eq("id", field_config_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      logger.warn("Field config not found for location update", {
        error: fieldConfigError,
        field_config_id,
      });
      return errorResponse("Field config not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      fieldConfig.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to update field config locations", {
        field_config_id,
        organization_id: fieldConfig.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this field config",
        403,
      );
    }

    // Delete all existing location restrictions for this field config
    const { error: deleteError } = await supabase
      .from("location_field_config")
      .delete()
      .eq("field_config_id", field_config_id);

    if (deleteError) throw deleteError;

    // If location_ids is provided and not empty, insert new restrictions
    if (location_ids && location_ids.length > 0) {
      // Verify all locations belong to the same organization
      const { data: locations, error: locationsError } = await supabase
        .from("location")
        .select("id")
        .eq("organization_id", fieldConfig.organization_id)
        .in("id", location_ids);

      if (locationsError) throw locationsError;

      const validLocationIds = locations?.map((loc) => loc.id) || [];
      const invalidLocationIds = location_ids.filter(
        (id: string) => !validLocationIds.includes(id),
      );

      if (invalidLocationIds.length > 0) {
        return errorResponse(
          `Invalid location IDs: ${invalidLocationIds.join(", ")}`,
          400,
        );
      }

      // Insert new location restrictions
      const insertData = validLocationIds.map((location_id) => ({
        field_config_id,
        location_id,
      }));

      const { error: insertError } = await supabase
        .from("location_field_config")
        .insert(insertData);

      if (insertError) throw insertError;
    }

    // Return the updated location restrictions
    const { data: locationRestrictions, error: fetchError } = await supabase
      .from("location_field_config")
      .select("location_id")
      .eq("field_config_id", field_config_id);

    if (fetchError) throw fetchError;

    logger.info("Field config locations updated successfully", {
      field_config_id,
      organization_id: fieldConfig.organization_id,
      location_count: locationRestrictions?.length || 0,
    });

    return jsonResponse({
      success: true,
      location_ids: locationRestrictions?.map((lr) => lr.location_id) ||
        [],
    });
  } catch (error) {
    logger.error("Update field config locations error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update location restrictions"),
      getErrorStatusCode(error),
    );
  }
});
