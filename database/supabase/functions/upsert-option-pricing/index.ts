import { serve } from "server";
import { z } from "zod";
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

// Zod schema for request validation
const upsertOptionPricingSchema = z.object({
  organization_id: z.string().uuid("Organization ID must be a valid UUID"),
  field_config_id: z.string().uuid("Field config ID must be a valid UUID"),
  option_value: z.string().min(1, "Option value is required"),
  customer_price: z
    .number()
    .nonnegative("Customer price must be non-negative")
    .finite("Customer price must be a finite number"),
  worker_payment_rate: z
    .number()
    .nonnegative("Worker payment rate must be non-negative")
    .finite("Worker payment rate must be a finite number")
    .optional()
    .nullable(),
  // location_id can be a valid UUID string, null, undefined, or the string "null"
  // We normalize it before UUID validation
  location_id: z.preprocess(
    (val) => {
      // Normalize: convert string "null", empty string, undefined to null
      if (val === null || val === undefined || val === "null" || val === "") {
        return null;
      }
      return val;
    },
    z.union([z.string().uuid("Location ID must be a valid UUID"), z.null()])
      .optional(),
  ),
  currency: z.string().default("USD").optional(),
});

/**
 * Normalize location_id - convert string "null", undefined, empty string to null
 */
function normalizeLocationId(
  locationId: string | null | undefined,
): string | null {
  if (
    locationId === null ||
    locationId === undefined ||
    locationId === "null" ||
    locationId === ""
  ) {
    return null;
  }
  return locationId;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "upsert-option-pricing" });

  try {
    const body = await req.json();

    // Validate with Zod
    const validationResult = upsertOptionPricingSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn("Invalid request body for option pricing upsert", {
        errors: validationResult.error.errors,
      });
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return errorResponse(`Validation error: ${errors}`, 400);
    }

    const {
      organization_id,
      field_config_id,
      option_value,
      customer_price,
      worker_payment_rate,
      location_id: rawLocationId,
      currency,
    } = validationResult.data;

    // Normalize location_id early (Zod already normalized it, but double-check)
    const location_id = normalizeLocationId(rawLocationId ?? null);

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to upsert option pricing", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Verify field config exists and is select or grouped_breakdown
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, field_type, organization_id, options")
      .eq("id", field_config_id)
      .eq("organization_id", organization_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      return errorResponse("Field config not found", 404);
    }

    if (
      fieldConfig.field_type !== "select" &&
      fieldConfig.field_type !== "grouped_breakdown"
    ) {
      return errorResponse(
        "Option pricing can only be set for select or grouped_breakdown fields",
        400,
      );
    }

    // Verify option_value exists in field config options
    const options = fieldConfig.options as string[] | null;
    if (!options || !options.includes(option_value)) {
      return errorResponse(
        `Option "${option_value}" not found in field config options`,
        400,
      );
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

    // Check if pricing exists for this combination
    let checkQuery = supabase
      .from("option_pricing")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("field_config_id", field_config_id)
      .eq("option_value", option_value);

    // Use .is() for null checks, .eq() for values (same pattern as list-option-pricing)
    if (location_id === null || location_id === undefined) {
      checkQuery = checkQuery.is("location_id", null);
    } else {
      checkQuery = checkQuery.eq("location_id", location_id);
    }

    const { data: existingPricing, error: checkError } = await checkQuery
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const upsertData: Record<string, unknown> = {
      organization_id,
      field_config_id,
      option_value,
      customer_price: customer_price,
      currency: currency || "USD",
      updated_at: new Date().toISOString(),
    };

    if (location_id) {
      upsertData.location_id = location_id;
    }

    if (worker_payment_rate !== undefined && worker_payment_rate !== null) {
      upsertData.worker_payment_rate = worker_payment_rate;
    }

    let optionPricing;
    if (existingPricing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from("option_pricing")
        .update(upsertData)
        .eq("id", existingPricing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      optionPricing = updated;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("option_pricing")
        .insert(upsertData)
        .select()
        .single();
      if (insertError) throw insertError;
      optionPricing = inserted;
    }

    logger.info("Option pricing upserted successfully", {
      option_pricing_id: optionPricing?.id,
      organization_id,
      field_config_id,
      option_value,
      location_id: location_id || null,
    });

    return jsonResponse({
      success: true,
      option_pricing: optionPricing,
    });
  } catch (error) {
    logger.error("Upsert option pricing error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to upsert option pricing"),
      getErrorStatusCode(error),
    );
  }
});
