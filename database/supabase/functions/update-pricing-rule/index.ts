import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface UpdatePricingRuleRequest {
  id: string;
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
    assignIfDefined("updated_by", body.updated_by ?? null);

    const { data: pricingRule, error: updateError } = await supabase
      .from("pricing_rule")
      .update(updateData)
      .eq("id", body.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

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
    return errorResponse(
      error instanceof Error ? error : "Failed to update pricing rule",
    );
  }
});
