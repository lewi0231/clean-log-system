import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
  PricingCondition,
  PricingRule,
  PricingScope,
  PricingType,
} from "@/lib/types";

export interface ListPricingRulesRequest {
  organization_id: string;
  scopes?: PricingScope[];
  include_inactive?: boolean;
  effective_at?: string;
  location_hierarchy_id?: string | null;
  location_id?: string | null;
  field_config_id?: string;
  option_value?: string;
}

export interface UpsertPricingRuleRequest {
  id?: string;
  organization_id: string;
  scope: PricingScope;
  pricing_type: PricingType;
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
  updated_by?: string | null;
  conditions?: Array<
    Omit<
      PricingCondition,
      | "id"
      | "pricing_rule_id"
      | "metadata"
      | "priority"
      | "condition_value"
      | "action_value"
    > & {
      condition_value: string | number;
      action_value: number;
      metadata?: Record<string, unknown>;
      priority?: number;
    }
  >;
}

export class PricingService {
  static async listRules(
    request: ListPricingRulesRequest
  ): Promise<PricingRule[]> {
    try {
      log.debug("PricingService: listing pricing rules", {
        organizationId: request.organization_id,
        scopes: request.scopes,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-pricing-rules",
        {
          body: request,
        }
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error("Failed to list pricing rules");
      }

      return data.pricing_rules as PricingRule[];
    } catch (err) {
      log.error("PricingService: Failed to list pricing rules", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async upsertRule(
    request: UpsertPricingRuleRequest
  ): Promise<PricingRule> {
    const functionName = request.id
      ? "update-pricing-rule"
      : "create-pricing-rule";

    try {
      log.debug("PricingService: upserting pricing rule", {
        organizationId: request.organization_id,
        scope: request.scope,
        pricingType: request.pricing_type,
        hasId: Boolean(request.id),
      });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: request,
      });

      if (error) throw error;

      if (!data || !data.pricing_rule) {
        throw new Error("Failed to upsert pricing rule");
      }

      return data.pricing_rule as PricingRule;
    } catch (err) {
      log.error("PricingService: Failed to upsert pricing rule", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async deleteRule(id: string): Promise<void> {
    try {
      log.debug("PricingService: deleting pricing rule", { id });

      const { data, error } = await supabase.functions.invoke(
        "delete-pricing-rule",
        {
          body: { id },
        }
      );

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error("Failed to delete pricing rule");
      }
    } catch (err) {
      log.error("PricingService: Failed to delete pricing rule", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
