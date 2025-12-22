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
import {
  validateNonNegativeNumber,
  validateRequiredFields,
} from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "upsert-base-pricing" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for base pricing upsert", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Organization ID is required", 400);
    }

    if (body.customer_base_price === undefined) {
      logger.warn("Missing customer_base_price for base pricing upsert", {
        organization_id: body.organization_id,
      });
      return errorResponse(
        "Organization ID and customer base price are required",
        400,
      );
    }

    const {
      organization_id,
      job_type_field_config_id,
      job_type_value,
      standalone_base_price,
      customer_base_price,
      worker_base_payment,
      adjustment_type,
      location_id,
      currency,
    } = body;

    // Validate that only one pricing type is specified
    if (
      (job_type_field_config_id && standalone_base_price !== undefined) ||
      (!job_type_field_config_id && standalone_base_price === undefined)
    ) {
      return errorResponse(
        "Must specify either job_type_field_config_id (field-based) or standalone_base_price (standalone), but not both",
        400,
      );
    }

    // Validate adjustment_type
    const validAdjustmentType = adjustment_type || "add";
    if (validAdjustmentType !== "add" && validAdjustmentType !== "multiply") {
      return errorResponse(
        "adjustment_type must be either 'add' or 'multiply'",
        400,
      );
    }

    // Validate customer_base_price based on adjustment_type
    if (validAdjustmentType === "add") {
      if (!validateNonNegativeNumber(customer_base_price)) {
        return errorResponse("Customer base price must be non-negative", 400);
      }
    } else {
      // For multiply, value must be > 0 (e.g., 1.2 for 20% increase, 0.9 for 10% decrease)
      if (
        !validateNonNegativeNumber(customer_base_price) ||
        customer_base_price <= 0
      ) {
        return errorResponse(
          "Customer base price (multiplier) must be greater than 0",
          400,
        );
      }
    }

    if (
      worker_base_payment !== undefined &&
      worker_base_payment !== null &&
      !validateNonNegativeNumber(worker_base_payment)
    ) {
      return errorResponse("Worker base payment must be non-negative", 400);
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to upsert base pricing", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Verify field config exists if field-based
    if (job_type_field_config_id) {
      const { data: fieldConfig, error: fieldConfigError } = await supabase
        .from("organization_field_configs")
        .select("id, field_type, organization_id, options")
        .eq("id", job_type_field_config_id)
        .eq("organization_id", organization_id)
        .single();

      if (fieldConfigError || !fieldConfig) {
        return errorResponse("Field config not found", 404);
      }

      if (fieldConfig.field_type !== "select") {
        return errorResponse(
          "Field-based base pricing can only use select fields",
          400,
        );
      }

      // Verify job_type_value exists in field config options
      const options = fieldConfig.options as string[] | null;
      if (!options || !options.includes(job_type_value)) {
        return errorResponse(
          `Job type value "${job_type_value}" not found in field config options`,
          400,
        );
      }
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
    const { data: existingPricing, error: checkError } = await supabase
      .from("base_pricing")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("job_type_field_config_id", job_type_field_config_id || null)
      .eq("job_type_value", job_type_value || "")
      .eq("location_id", location_id || null)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    const upsertData: Record<string, unknown> = {
      organization_id,
      customer_base_price: customer_base_price,
      adjustment_type: validAdjustmentType,
      currency: currency || "USD",
      updated_at: new Date().toISOString(),
    };

    if (job_type_field_config_id) {
      upsertData.job_type_field_config_id = job_type_field_config_id;
      upsertData.job_type_value = job_type_value;
      upsertData.standalone_base_price = null;
    } else {
      upsertData.job_type_field_config_id = null;
      upsertData.job_type_value = job_type_value || "Default";
      upsertData.standalone_base_price = parseFloat(standalone_base_price);
    }

    if (location_id) {
      upsertData.location_id = location_id;
    }

    if (worker_base_payment !== undefined && worker_base_payment !== null) {
      upsertData.worker_base_payment = parseFloat(worker_base_payment);
    }

    let basePricing;
    if (existingPricing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from("base_pricing")
        .update(upsertData)
        .eq("id", existingPricing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      basePricing = updated;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("base_pricing")
        .insert(upsertData)
        .select()
        .single();
      if (insertError) throw insertError;
      basePricing = inserted;
    }

    logger.info("Base pricing upserted successfully", {
      base_pricing_id: basePricing?.id,
      organization_id,
      job_type_field_config_id: job_type_field_config_id || null,
      location_id: location_id || null,
    });

    return jsonResponse({
      success: true,
      base_pricing: basePricing,
    });
  } catch (error) {
    logger.error("Upsert base pricing error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to upsert base pricing"),
      getErrorStatusCode(error),
    );
  }
});
