import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

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

export interface WorkerPaymentCalculation {
    job_id: string;
    line_items: WorkerPaymentLineItem[];
    applied_rules: AppliedRule[];
    subtotal: number;
    total_adjustments: number;
    total_worker_payment: number;
}

export interface CalculateWorkerPaymentsResponse {
    success: boolean;
    calculation: {
        total_worker_payment: number;
        job_calculations: WorkerPaymentCalculation[];
    };
}

export class WorkerPaymentService {
    static async calculatePayments(
        request: CalculateWorkerPaymentsRequest,
    ): Promise<CalculateWorkerPaymentsResponse> {
        try {
            log.debug("WorkerPaymentService: Calculating worker payments", {
                organizationId: request.organization_id,
                jobCount: request.job_ids.length,
            });

            const { data, error } = await supabase.functions.invoke(
                "calculate-worker-payment",
                {
                    body: request,
                },
            );

            if (error) throw error;

            if (!data || !data.success) {
                throw new Error("Failed to calculate worker payments");
            }

            return data as CalculateWorkerPaymentsResponse;
        } catch (err) {
            log.error(
                "WorkerPaymentService: Failed to calculate worker payments",
                {
                    error: err instanceof Error ? err.message : "Unknown error",
                },
            );
            throw err;
        }
    }
}
