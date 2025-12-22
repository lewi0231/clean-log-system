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
const upsertServicePricingModeSchema = z.object({
  organization_id: z.string().uuid("Organization ID must be a valid UUID"),
  service_type_field_config_id: z
    .string()
    .uuid("Service type field config ID must be a valid UUID"),
  service_type_value: z.string().min(1, "Service type value is required"),
  pricing_mode: z.enum(["field_based", "fixed_price"], {
    errorMap: () => ({
      message: "Pricing mode must be 'field_based' or 'fixed_price'",
    }),
  }),
  fixed_customer_price: z
    .number()
    .nonnegative("Fixed customer price must be non-negative")
    .finite("Fixed customer price must be a finite number")
    .nullable()
    .optional(),
  fixed_worker_payment: z
    .number()
    .nonnegative("Fixed worker payment must be non-negative")
    .finite("Fixed worker payment must be a finite number")
    .nullable()
    .optional(),
  fixed_price_currency: z.string().default("USD").optional(),
  // location_id can be a valid UUID string, null, undefined, or the string "null"
  location_id: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === "null" || val === "") {
        return null;
      }
      return val;
    },
    z.union([z.string().uuid("Location ID must be a valid UUID"), z.null()])
      .optional(),
  ),
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

  const logger = createLogger(req, {
    functionName: "upsert-service-pricing-mode",
  });

  try {
    const body = await req.json();

    // Validate with Zod
    const validationResult = upsertServicePricingModeSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn("Invalid request body for service pricing mode upsert", {
        errors: validationResult.error.errors,
      });
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return errorResponse(`Validation error: ${errors}`, 400);
    }

    const {
      organization_id,
      service_type_field_config_id,
      service_type_value,
      pricing_mode,
      fixed_customer_price,
      fixed_worker_payment,
      location_id: rawLocationId,
      fixed_price_currency,
    } = validationResult.data;

    // Normalize location_id
    const location_id = normalizeLocationId(rawLocationId ?? null);

    // Validate fixed_price requirements
    if (pricing_mode === "fixed_price") {
      if (
        fixed_customer_price === null ||
        fixed_customer_price === undefined ||
        fixed_worker_payment === null ||
        fixed_worker_payment === undefined
      ) {
        return errorResponse(
          "fixed_customer_price and fixed_worker_payment are required when pricing_mode is 'fixed_price'",
          400,
        );
      }
      if (!fixed_price_currency) {
        return errorResponse(
          "fixed_price_currency is required when pricing_mode is 'fixed_price'",
          400,
        );
      }
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to upsert service pricing mode", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Verify field config exists and is select type
    const { data: fieldConfig, error: fieldConfigError } = await supabase
      .from("organization_field_configs")
      .select("id, field_type, organization_id, options")
      .eq("id", service_type_field_config_id)
      .eq("organization_id", organization_id)
      .single();

    if (fieldConfigError || !fieldConfig) {
      return errorResponse("Field config not found", 404);
    }

    if (fieldConfig.field_type !== "select") {
      return errorResponse(
        "Service pricing mode can only be set for select fields",
        400,
      );
    }

    // Verify service_type_value exists in field config options
    const options = fieldConfig.options as string[] | null;
    if (!options || !options.includes(service_type_value)) {
      return errorResponse(
        `Service type value "${service_type_value}" not found in field config options`,
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

    // Check if service pricing mode exists for this combination
    let checkQuery = supabase
      .from("service_pricing_mode")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("service_type_field_config_id", service_type_field_config_id)
      .eq("service_type_value", service_type_value);

    if (location_id === null || location_id === undefined) {
      checkQuery = checkQuery.is("location_id", null);
    } else {
      checkQuery = checkQuery.eq("location_id", location_id);
    }

    const { data: existingMode, error: checkError } = await checkQuery
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const upsertData: Record<string, unknown> = {
      organization_id,
      service_type_field_config_id,
      service_type_value,
      pricing_mode,
      updated_at: new Date().toISOString(),
    };

    if (location_id) {
      upsertData.location_id = location_id;
    }

    if (pricing_mode === "fixed_price") {
      upsertData.fixed_customer_price = fixed_customer_price;
      upsertData.fixed_worker_payment = fixed_worker_payment;
      upsertData.fixed_price_currency = fixed_price_currency || "USD";
    } else {
      // field_based mode - set to null
      upsertData.fixed_customer_price = null;
      upsertData.fixed_worker_payment = null;
      upsertData.fixed_price_currency = "USD"; // Default, but not used
    }

    let servicePricingMode;
    if (existingMode) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from("service_pricing_mode")
        .update(upsertData)
        .eq("id", existingMode.id)
        .select()
        .single();
      if (updateError) throw updateError;
      servicePricingMode = updated;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("service_pricing_mode")
        .insert(upsertData)
        .select()
        .single();
      if (insertError) throw insertError;
      servicePricingMode = inserted;
    }

    logger.info("Service pricing mode upserted successfully", {
      service_pricing_mode_id: servicePricingMode?.id,
      organization_id,
      service_type_field_config_id,
      service_type_value,
      pricing_mode,
      location_id: location_id || null,
    });

    return jsonResponse({
      success: true,
      service_pricing_mode: servicePricingMode,
    });
  } catch (error) {
    logger.error("Upsert service pricing mode error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to upsert service pricing mode"),
      getErrorStatusCode(error),
    );
  }
});
