import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "list-service-pricing-modes" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, location_id, service_type_field_config_id, service_type_value } = body;

    const supabase = createServiceRoleClient();

    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) {
      if (orgGate.response.status === 403) {
        logger.warn("Unauthorized organization access attempt", {
          organization_id,
        });
      }
      return orgGate.response;
    }

    // Build query
    let query = supabase
      .from("service_pricing_mode")
      .select(
        `
        *,
        field_config:service_type_field_config_id (
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

    if (service_type_field_config_id) {
      query = query.eq("service_type_field_config_id", service_type_field_config_id);
    }

    if (service_type_value) {
      query = query.eq("service_type_value", service_type_value);
    }

    if (location_id !== undefined) {
      if (location_id === null) {
        query = query.is("location_id", null);
      } else {
        query = query.eq("location_id", location_id);
      }
    }

    const { data: servicePricingModes, error: pricingError } = await query.order(
      "service_type_value",
      { ascending: true }
    );

    if (pricingError) throw pricingError;

    return jsonResponse({
      success: true,
      service_pricing_modes: servicePricingModes || [],
    });
  } catch (error) {
    logger.error("List service pricing modes error", error);
    return errorResponse(error instanceof Error ? error : "Failed to list service pricing modes");
  }
});
