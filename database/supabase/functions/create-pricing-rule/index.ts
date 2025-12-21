import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  createPricingRuleSchema,
  validateRequest,
} from "../_utils/zod-schemas.ts";

interface PricingConditionInput {
  organization_id: string;
  scope: "field" | "option" | "base" | "global";
  pricing_type: "unit" | "fixed" | "tiered" | "percentage" | "conditional";
  pricing_context?: "customer" | "worker"; // Defaults to 'customer' for backward compatibility
  field_config_id?: string | null;
  option_value?: string | null;
  applies_to_field_type?: string | null;
  location_hierarchy_id?: string | null;
  location_id?: string | null;
  currency?: string;
  base_price?: number | null;
  percentage_rate?: number | null;
  minimum_quantity?: number | null;
  maximum_quantity?: number | null;
  tier_definition?: unknown;
  metadata?: Record<string, unknown>;
  worker_payment_type?: "same_structure" | "percentage" | "fixed_rate" | null;
  worker_payment_value?: number | null;
  priority?: number;
  active?: boolean;
  effective_at?: string;
  expires_at?: string | null;
  created_by?: string | null;
  conditions?: PricingConditionInput[];
  [key: string]: unknown;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "create-pricing-rule" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(createPricingRuleSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body", { errors: validation.issues });
      return errorResponse(validation.error, 400);
    }

    // After success check, validation.data is properly typed
    const body = validation.data;

    const supabase = createServiceRoleClient();

    const {
      organization_id,
      scope,
      pricing_type,
      pricing_context,
      field_config_id,
      option_value,
      applies_to_field_type,
      location_hierarchy_id,
      location_id,
      currency,
      base_price,
      percentage_rate,
      minimum_quantity,
      maximum_quantity,
      tier_definition,
      metadata,
      worker_payment_type,
      worker_payment_value,
      priority,
      active,
      effective_at,
      expires_at,
      created_by,
      conditions,
    } = body;

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Extract user from membership check for created_by/updated_by
    // Note: created_by and updated_by are UUID fields (auth.users.id), not emails
    const userId = membershipCheck.userId;

    // Scope validation is now handled by Zod schema, but keeping for clarity
    // The schema's refine() method ensures field_config_id is present for "field" scope
    // and both field_config_id and option_value are present for "option" scope

    // Validate pricing_context
    if (
      pricing_context &&
      pricing_context !== "customer" &&
      pricing_context !== "worker"
    ) {
      return errorResponse(
        "pricing_context must be either 'customer' or 'worker'",
        400,
      );
    }

    // Worker payment rules should not have worker_payment_type/worker_payment_value
    // Those fields are for customer rules with embedded worker payments
    if (pricing_context === "worker") {
      if (worker_payment_type || worker_payment_value !== undefined) {
        return errorResponse(
          "Worker payment rules cannot have worker_payment_type or worker_payment_value. Use separate worker pricing rules instead.",
          400,
        );
      }
    }

    if (field_config_id) {
      const { data: fieldConfig, error: fieldConfigError } = await supabase
        .from("organization_field_configs")
        .select("id, organization_id")
        .eq("id", field_config_id)
        .eq("organization_id", organization_id)
        .single();

      if (fieldConfigError || !fieldConfig) {
        return errorResponse("Field config not found", 404);
      }
    }

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

    if (location_hierarchy_id) {
      const { data: node, error: nodeError } = await supabase
        .from("location_hierarchy")
        .select("id, organization_id")
        .eq("id", location_hierarchy_id)
        .eq("organization_id", organization_id)
        .single();

      if (nodeError || !node) {
        return errorResponse("Location hierarchy node not found", 404);
      }
    }

    // Fetch organization currency to use as default if currency not provided
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select("currency")
      .eq("id", organization_id)
      .single();

    if (orgError) {
      logger.error("Error fetching organization currency", orgError, {
        organization_id,
      });
      // Don't fail, just use USD as fallback
    }

    const defaultCurrency = organization?.currency || "USD";

    const insertPayload = {
      organization_id,
      scope,
      pricing_type,
      pricing_context: pricing_context || "customer", // Default to 'customer' for backward compatibility
      field_config_id: field_config_id || null,
      option_value: option_value || null,
      applies_to_field_type: applies_to_field_type || null,
      location_hierarchy_id: location_hierarchy_id || null,
      location_id: location_id || null,
      currency: currency || defaultCurrency,
      base_price: base_price ?? null,
      percentage_rate: percentage_rate ?? null,
      minimum_quantity: minimum_quantity ?? null,
      maximum_quantity: maximum_quantity ?? null,
      tier_definition: tier_definition || null,
      metadata: metadata || {},
      worker_payment_type: worker_payment_type || null,
      worker_payment_value: worker_payment_value ?? null,
      priority: priority || 0,
      active: active !== undefined ? active : true,
      effective_at: effective_at || new Date().toISOString(),
      expires_at: expires_at || null,
      created_by: created_by || userId || null,
      updated_by: created_by || userId || null,
    };

    logger.debug("Creating pricing rule", {
      organization_id,
      scope,
      pricing_type,
      pricing_context: pricing_context || "customer",
      field_config_id,
      location_id,
      location_hierarchy_id,
      base_price,
      created_by: insertPayload.created_by,
      userId,
    });

    const { data: pricingRule, error: createError } = await supabase
      .from("pricing_rule")
      .insert(insertPayload)
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
        ),
        location_node:location_hierarchy_id (
          id,
          name,
          type,
          parent_id
        )
      `,
      )
      .single();

    if (createError) {
      logger.error("Error creating pricing rule", createError, {
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        organization_id,
        scope,
        pricing_type,
      });

      // Check if it's a unique constraint violation
      if (createError.code === "23505") {
        return errorResponse(
          `A pricing rule already exists for this configuration. Please update the existing rule instead. Details: ${
            createError.details || createError.message
          }`,
          409,
        );
      }

      throw createError;
    }

    logger.info("Pricing rule created successfully", {
      ruleId: pricingRule?.id,
      scope,
      pricing_context: pricingRule?.pricing_context,
    });

    if (conditions && conditions.length > 0) {
      const conditionPayload = conditions.map((condition: {
        condition_field_config_id: string;
        operator: string;
        condition_value: string | number;
        action_type: string;
        action_value: string | number;
        metadata?: Record<string, unknown>;
        priority?: number;
      }) => ({
        pricing_rule_id: pricingRule.id,
        condition_field_config_id: condition.condition_field_config_id,
        operator: condition.operator,
        condition_value: String(condition.condition_value),
        action_type: condition.action_type,
        action_value: condition.action_value,
        metadata: condition.metadata || {},
        priority: condition.priority || 0,
      }));

      const { error: conditionError } = await supabase
        .from("pricing_condition")
        .insert(conditionPayload);

      if (conditionError) {
        // Clean up inserted rule to keep data consistent
        await supabase.from("pricing_rule").delete().eq("id", pricingRule.id);
        throw conditionError;
      }
    }

    return jsonResponse({
      success: true,
      pricing_rule: pricingRule,
    });
  } catch (error) {
    logger.error("Create pricing rule error", error);

    // Extract error message from various error types
    let errorMessage = "Failed to create pricing rule";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      // Handle Postgres errors and other object errors
      if ("message" in error && typeof error.message === "string") {
        errorMessage = error.message;
      } else if ("details" in error && typeof error.details === "string") {
        errorMessage = error.details;
      } else if ("hint" in error && typeof error.hint === "string") {
        errorMessage = error.hint;
      } else {
        errorMessage = JSON.stringify(error);
      }
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return errorResponse(errorMessage, 500);
  }
});
