import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "list-base-pricing" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, location_id } = body;

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
      .from("base_pricing")
      .select(
        `
        *,
        field_config:job_type_field_config_id (
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

    if (location_id !== undefined) {
      if (location_id === null) {
        query = query.is("location_id", null);
      } else {
        query = query.eq("location_id", location_id);
      }
    }

    const { data: basePricing, error: pricingError } = await query.order("created_at", {
      ascending: true,
    });

    if (pricingError) throw pricingError;

    return jsonResponse({
      success: true,
      base_pricing: basePricing || [],
    });
  } catch (error) {
    logger.error("List base pricing error", error);
    return errorResponse(error instanceof Error ? error : "Failed to list base pricing");
  }
});
