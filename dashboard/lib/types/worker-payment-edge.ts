/**
 * Worker payment calculation Edge JSON shapes — shared by `worker-payment.service.ts`
 * and `edge-contracts.ts` without cycles.
 */

export interface CalculateWorkerPaymentsRequest {
  organization_id: string;
  job_ids: string[];
}

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
  time_share: number;
  multiplier_adjustment: number;
  per_unit_bonus: number;
  flat_bonus: number;
  team_percentage_bonus: number;
  final_payment: number;
  rate_card_id?: string;
  allocation_type: string;
  /** Rate-card pool share weight (default 1.0). */
  split_weight?: number;
}

export interface WorkerPaymentCalculation {
  job_id: string;
  line_items: WorkerPaymentLineItem[];
  applied_rules: AppliedRule[];
  subtotal: number;
  total_adjustments: number;
  total_worker_payment: number;
  worker_splits?: WorkerPaymentSplit[];
  /** Warnings from calculate-worker-payment (e.g. mixed job_worker times). */
  calculation_warnings?: string[];
}

export interface CalculateWorkerPaymentsResponse {
  success: boolean;
  calculation: {
    total_worker_payment: number;
    job_calculations: WorkerPaymentCalculation[];
  };
}
