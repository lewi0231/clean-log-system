export interface WorkerPaymentLineItem {
  field_config_id: string;
  field_name: string;
  field_label: string;
  option_value?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface AppliedRule {
  pricing_rule_id: string;
  scope: string;
  pricing_type: string;
  field_config_id: string | null;
  option_value: string | null;
  location_hierarchy_id: string | null;
  location_id: string | null;
  amount: number;
  metadata: Record<string, unknown>;
  line_item_key?: string;
  snapshot_data: Record<string, unknown>;
}

export interface WorkerPaymentSplit {
  worker_id: string;
  worker_name: string;
  hours_worked: number;
  time_share: number; // Their share of the base payment
  multiplier_adjustment: number; // Additional from multiplier modifier
  per_unit_bonus: number; // Additive bonus (per unit)
  flat_bonus: number; // Additive bonus (flat)
  team_percentage_bonus: number; // Additive bonus (percentage of team earnings)
  final_payment: number; // Total for this worker
  rate_card_id?: string;
  allocation_type: string;
  /** Rate-card pool share weight (default 1.0). Hours × weight drives the base pool split. */
  split_weight: number;
}

export interface WorkerPaymentCalculation {
  job_id: string;
  line_items: WorkerPaymentLineItem[];
  applied_rules: AppliedRule[];
  subtotal: number;
  total_adjustments: number;
  total_worker_payment: number;
  worker_splits?: WorkerPaymentSplit[];
  /** Populated when split logic needs admin attention (e.g. mixed job_worker times). */
  calculation_warnings?: string[];
}

export type FieldConfig = {
  id: string;
  name: string;
  label: string;
  field_type: string;
  options?: string[] | null;
};

export type JobRecord = {
  id: string;
  organization_id: string;
  location_id: string | null;
  submission_data: Record<string, unknown> | null;
  hierarchy_parent_id?: string | null;
  location?: LocationRecord | null;
};

export type PricingConditionRow = {
  id: string;
  condition_field_config_id: string;
  operator: string;
  condition_value: string;
  action_type: string;
  action_value: number;
  metadata: Record<string, unknown> | null;
  priority: number | null;
};

export type PricingRuleRow = {
  id: string;
  organization_id: string;
  scope: string;
  pricing_type: string;
  pricing_context: string | null;
  field_config_id: string | null;
  option_value: string | null;
  applies_to_field_type: string | null;
  location_hierarchy_id: string | null;
  location_id: string | null;
  currency: string;
  base_price: number | null;
  percentage_rate: number | null;
  minimum_quantity: number | null;
  maximum_quantity: number | null;
  tier_definition: unknown;
  metadata: Record<string, unknown> | null;
  priority: number | null;
  conditions?: PricingConditionRow[];
};

export type LocationRecord = {
  id: string;
  pricing_mode: string | null;
  fixed_worker_payment: number | null;
  fixed_price_currency: string | null;
  hierarchy_parent_id: string | null;
};

export type ServicePricingModeRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  service_type_field_config_id: string;
  service_type_value: string;
  pricing_mode: "field_based" | "fixed_price";
  fixed_customer_price: number | null;
  fixed_worker_payment: number | null;
  fixed_price_currency: string | null;
};

export type LocationHierarchyNode = {
  id: string;
  parent_id: string | null;
};

export type LocationContext = {
  locationId: string | null;
  ancestors: Set<string>;
  depthMap: Map<string, number>;
};

export type RateCardModifierType =
  | "per_unit"
  | "flat"
  | "multiplier"
  | "team_percentage"
  | "split_weight";

export type WorkerRateCard = {
  id: string;
  worker_id: string;
  modifier_type: RateCardModifierType;
  modifier_value: number;
  currency: string;
  role_title: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  // Joined field mappings (for per_unit type)
  field_config_ids?: string[];
};

export type JobWorker = {
  job_id: string;
  worker_id: string;
  start_time: string | null;
  end_time: string | null;
  worker: {
    id: string;
    first_name: string;
    last_name: string;
  };
};
