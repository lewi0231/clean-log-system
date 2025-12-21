import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  verifyOrganizationMembershipFromRequest,
} from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface UpdatePricingRuleRequest {
  id: string;
  organization_id?: string; // Optional but recommended for security validation
  scope?: "field" | "option" | "base" | "global";
  pricing_type?: "unit" | "fixed" | "tiered" | "percentage" | "conditional";
  pricing_context?: "customer" | "worker";
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
  updated_by?: string | null;
  conditions?: Array<{
    condition_field_config_id: string;
    operator: string;
    condition_value: string | number;
    action_type: string;
    action_value: number;
    metadata?: Record<string, unknown>;
    priority?: number;
  }>;
  [key: string]: unknown;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as UpdatePricingRuleRequest;
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      return errorResponse("ID is required", 400);
    }

    // Extract user from auth token for updated_by
    // Note: updated_by is a UUID field (auth.users.id), not email
    let userId: string | null = null;
    const token = extractAuthToken(req);
    if (token) {
      const authUser = await getAuthUser(token);
      if (authUser?.id) {
        userId = authUser.id;
      }
    }

    // Validate pricing_context if provided
    if (body.pricing_context !== undefined) {
      if (
        body.pricing_context !== "customer" &&
        body.pricing_context !== "worker"
      ) {
        return errorResponse(
          "pricing_context must be either 'customer' or 'worker'",
          400,
        );
      }

      // Worker payment rules should not have worker_payment_type/worker_payment_value
      if (body.pricing_context === "worker") {
        if (
          body.worker_payment_type !== undefined ||
          body.worker_payment_value !== undefined
        ) {
          return errorResponse(
            "Worker payment rules cannot have worker_payment_type or worker_payment_value. Use separate worker pricing rules instead.",
            400,
          );
        }
      }
    }

    const supabase = createServiceRoleClient();

    // Verify the pricing rule exists and optionally validate organization_id
    const { data: existingRule, error: fetchError } = await supabase
      .from("pricing_rule")
      .select("id, organization_id")
      .eq("id", body.id)
      .single();

    if (fetchError || !existingRule) {
      return errorResponse("Pricing rule not found", 404);
    }

    // If organization_id is provided, validate it matches and verify membership
    if (body.organization_id) {
      if (existingRule.organization_id !== body.organization_id) {
        return errorResponse(
          "Pricing rule does not belong to the specified organization",
          403,
        );
      }

      // Verify organization membership
      const membershipCheck = await verifyOrganizationMembershipFromRequest(
        req,
        body.organization_id,
        supabase,
      );
      if (!membershipCheck) {
        return errorResponse(
          "You do not have permission to access this organization",
          403,
        );
      }
    } else {
      // Even if organization_id is not provided, verify membership for the rule's organization
      const membershipCheck = await verifyOrganizationMembershipFromRequest(
        req,
        existingRule.organization_id,
        supabase,
      );
      if (!membershipCheck) {
        return errorResponse(
          "You do not have permission to access this organization",
          403,
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const assignIfDefined = <T>(
      key: string,
      value: T | undefined,
      mapper?: (value: T) => unknown,
    ) => {
      if (value !== undefined) {
        updateData[key] = mapper ? mapper(value) : value;
      }
    };

    assignIfDefined("scope", body.scope);
    assignIfDefined("pricing_type", body.pricing_type);
    assignIfDefined("pricing_context", body.pricing_context);
    assignIfDefined("field_config_id", body.field_config_id ?? null);
    assignIfDefined("option_value", body.option_value ?? null);
    assignIfDefined(
      "applies_to_field_type",
      body.applies_to_field_type ?? null,
    );
    assignIfDefined(
      "location_hierarchy_id",
      body.location_hierarchy_id ?? null,
    );
    assignIfDefined("location_id", body.location_id ?? null);
    assignIfDefined("currency", body.currency);
    assignIfDefined("base_price", body.base_price ?? null);
    assignIfDefined("percentage_rate", body.percentage_rate ?? null);
    assignIfDefined("minimum_quantity", body.minimum_quantity ?? null);
    assignIfDefined("maximum_quantity", body.maximum_quantity ?? null);
    assignIfDefined("tier_definition", body.tier_definition ?? null);
    assignIfDefined("metadata", body.metadata ?? {});
    assignIfDefined("worker_payment_type", body.worker_payment_type ?? null);
    assignIfDefined("worker_payment_value", body.worker_payment_value ?? null);
    assignIfDefined("priority", body.priority);
    assignIfDefined("active", body.active);
    assignIfDefined("effective_at", body.effective_at);
    assignIfDefined("expires_at", body.expires_at ?? null);
    // Use userId from auth token if updated_by not explicitly provided
    assignIfDefined("updated_by", body.updated_by ?? userId ?? null);

    console.log("[Pricing Debug] Updating pricing rule:", {
      ruleId: body.id,
      organization_id: existingRule.organization_id,
      updateData: Object.keys(updateData),
      base_price: updateData.base_price,
      location_id: updateData.location_id,
      location_hierarchy_id: updateData.location_hierarchy_id,
      pricing_context: updateData.pricing_context,
      updated_by: updateData.updated_by,
      userId,
    });

    const { data: pricingRule, error: updateError } = await supabase
      .from("pricing_rule")
      .update(updateData)
      .eq("id", body.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[Pricing Debug] Error updating pricing rule:", {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        ruleId: body.id,
        updateData,
      });

      // Check if it's a unique constraint violation
      if (updateError.code === "23505") {
        return errorResponse(
          `A pricing rule already exists for this configuration. This may occur if you're trying to change the rule's scope in a way that conflicts with an existing rule. Details: ${
            updateError.details || updateError.message
          }`,
          409,
        );
      }

      throw updateError;
    }

    console.log("[Pricing Debug] Pricing rule updated successfully:", {
      ruleId: pricingRule?.id,
      scope: pricingRule?.scope,
      pricing_context: pricingRule?.pricing_context,
    });

    if (!pricingRule) {
      return errorResponse("Pricing rule not found", 404);
    }

    if (body.conditions) {
      await supabase
        .from("pricing_condition")
        .delete()
        .eq("pricing_rule_id", pricingRule.id);

      if (body.conditions.length > 0) {
        const conditionPayload = body.conditions.map((condition) => ({
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

        if (conditionError) throw conditionError;
      }
    }

    return jsonResponse({
      success: true,
      pricing_rule: pricingRule,
    });
  } catch (error) {
    console.error("Update pricing rule error:", error);

    // Extract error message from various error types
    let errorMessage = "Failed to update pricing rule";
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
