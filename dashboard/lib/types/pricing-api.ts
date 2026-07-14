/**
 * Pricing Edge request/response types — shared by `pricing.service.ts` and `edge-contracts.ts`.
 */

import type { PricingCondition, PricingRule, PricingScope, PricingType } from "@/lib/types";

export interface ListPricingRulesRequest {
  organization_id: string;
  scopes?: PricingScope[];
  include_inactive?: boolean;
  effective_at?: string;
  location_hierarchy_id?: string | null;
  location_id?: string | null;
  field_config_id?: string;
  option_value?: string;
  pricing_context?: "customer" | "worker";
}

export interface ListPricingRulesResponse {
  success: boolean;
  pricing_rules?: PricingRule[];
  error?: string;
}

export interface UpsertPricingRuleRequest {
  id?: string;
  organization_id: string;
  scope: PricingScope;
  pricing_type: PricingType;
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
  updated_by?: string | null;
  conditions?: Array<
    Omit<
      PricingCondition,
      "id" | "pricing_rule_id" | "metadata" | "priority" | "condition_value" | "action_value"
    > & {
      condition_value: string | number;
      action_value: number;
      metadata?: Record<string, unknown>;
      priority?: number;
    }
  >;
}

export interface UpsertPricingRuleResponse {
  success?: boolean;
  pricing_rule?: PricingRule;
  error?: string;
}

export interface DeletePricingRuleRequest {
  id: string;
}

export interface DeletePricingRuleResponse {
  success: boolean;
  error?: string;
}

export interface ListPricingHistoryRequest {
  organization_id: string;
  date_from?: string;
  date_to?: string;
  pricing_context?: "customer" | "worker";
}

export interface ListPricingHistoryResponse {
  success: boolean;
  pricing_history?: PricingHistoryEntry[];
  error?: string;
}

export interface PricingHistoryEntry {
  id: string;
  field_name: string;
  option_value?: string;
  /** Display label for a location or hierarchy node; empty when the rule is org-wide (default). */
  location_name?: string;
  /** Set when the rule applies to a specific site; null means not location-scoped. */
  location_id?: string | null;
  /** Set when the rule applies to a region/company node; null means not node-scoped. */
  location_hierarchy_id?: string | null;
  old_price?: number;
  new_price: number;
  effective_at: string;
  changed_at?: string; // When the change was actually made (audit timestamp)
  expires_at?: string;
  changed_by?: string;
  change_type: "created" | "updated" | "expired";
  pricing_context?: "customer" | "worker";
}
