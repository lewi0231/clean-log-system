import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface PricingConditionInput {
  condition_field_config_id: string;
  operator: string;
  condition_value: string | number;
  action_type: string;
  action_value: number;
  metadata?: Record<string, unknown>;
  priority?: number;
}

interface CreatePricingRuleRequest {
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

  try {
    const body = (await req.json()) as CreatePricingRuleRequest;
    const validation = validateRequiredFields(body, [
      "organization_id",
      "scope",
      "pricing_type",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    // Extract user from auth token for created_by/updated_by
    // Note: created_by and updated_by are UUID fields (auth.users.id), not emails
    let userId: string | null = null;
    const token = extractAuthToken(req);
    if (token) {
      const authUser = await getAuthUser(token);
      if (authUser?.id) {
        userId = authUser.id;
      }
    }

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

    if (scope === "field" && !field_config_id) {
      return errorResponse("field_config_id is required for field scope", 400);
    }

    if (scope === "option" && (!field_config_id || !option_value)) {
      return errorResponse(
        "field_config_id and option_value are required for option scope",
        400,
      );
    }

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

    const supabase = createServiceRoleClient();

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
      currency: currency || "USD",
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

    console.log("[Pricing Debug] Creating pricing rule:", {
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
      console.error("[Pricing Debug] Error creating pricing rule:", {
        error: createError,
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        insertPayload,
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

    console.log("[Pricing Debug] Pricing rule created successfully:", {
      ruleId: pricingRule?.id,
      scope,
      pricing_context: pricingRule?.pricing_context,
    });

    if (conditions && conditions.length > 0) {
      const conditionPayload = conditions.map((condition) => ({
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
    console.error("Create pricing rule error:", error);

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
