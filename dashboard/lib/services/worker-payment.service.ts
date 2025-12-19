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

export interface PaymentRecord {
    id: string;
    dateRange: { start: string; end: string };
    jobIds: string[];
    totalPayment: number;
    workerCount: number;
    calculation: CalculateWorkerPaymentsResponse;
    calculatedAt: string;
}

export interface WorkerSummary {
    workerId: string;
    workerName: string;
    jobCount: number;
    totalPayment: number;
    averagePayment: number;
    jobs: string[];
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

    /**
     * Export payment calculations to CSV format
     */
    static exportPaymentsToCSV(
        payment: PaymentRecord,
        jobs: Array<{ id: string; workers: Array<{ name: string }> }>,
    ): string {
        const csvRows = [
            ["Job ID", "Total Payment", "Workers"],
            ...payment.calculation.calculation.job_calculations.map((calc) => {
                const job = jobs.find((j) => j.id === calc.job_id);
                return [
                    calc.job_id,
                    calc.total_worker_payment.toString(),
                    job?.workers.map((w) => w.name).join(", ") || "",
                ];
            }),
        ];

        return csvRows.map((row) => row.join(",")).join("\n");
    }

    /**
     * Aggregate payments by worker from payment records
     */
    static aggregateByWorker(
        payments: PaymentRecord[],
        jobs: Array<{
            id: string;
            workers: Array<{ id: string; name: string }>;
        }>,
    ): WorkerSummary[] {
        const workerMap = new Map<string, WorkerSummary>();

        payments.forEach((payment) => {
            payment.calculation.calculation.job_calculations.forEach((calc) => {
                const job = jobs.find((j) => j.id === calc.job_id);
                if (!job) return;

                job.workers.forEach((worker) => {
                    const existing = workerMap.get(worker.id);
                    if (existing) {
                        existing.jobCount += 1;
                        existing.totalPayment += calc.total_worker_payment;
                        existing.jobs.push(calc.job_id);
                    } else {
                        workerMap.set(worker.id, {
                            workerId: worker.id,
                            workerName: worker.name,
                            jobCount: 1,
                            totalPayment: calc.total_worker_payment,
                            averagePayment: calc.total_worker_payment,
                            jobs: [calc.job_id],
                        });
                    }
                });
            });
        });

        // Calculate averages
        workerMap.forEach((summary) => {
            summary.averagePayment = summary.totalPayment / summary.jobCount;
        });

        return Array.from(workerMap.values()).sort(
            (a, b) => b.totalPayment - a.totalPayment,
        );
    }

    /**
     * Filter payment records by date range
     */
    static filterByDateRange(
        payments: PaymentRecord[],
        startDate?: string,
        endDate?: string,
    ): PaymentRecord[] {
        if (!startDate && !endDate) return payments;

        return payments.filter((payment) => {
            const recordStart = new Date(payment.dateRange.start);
            const recordEnd = new Date(payment.dateRange.end);

            if (startDate) {
                const filterStart = new Date(startDate);
                if (recordEnd < filterStart) return false;
            }

            if (endDate) {
                const filterEnd = new Date(endDate);
                if (recordStart > filterEnd) return false;
            }

            return true;
        });
    }

    /**
     * Filter payment records by worker
     */
    static filterByWorker(
        payments: PaymentRecord[],
        workerId: string,
        jobs: Array<{
            id: string;
            workers: Array<{ id: string }>;
        }>,
    ): PaymentRecord[] {
        return payments.filter((payment) => {
            return payment.jobIds.some((jobId) => {
                const job = jobs.find((j) => j.id === jobId);
                return job?.workers.some((w) => w.id === workerId);
            });
        });
    }

    /**
     * Save worker payment calculation to database
     */
    static async savePayment(
        organizationId: string,
        calculation: CalculateWorkerPaymentsResponse,
        jobIds: string[],
    ): Promise<{ success: boolean; batch_id: string }> {
        try {
            log.debug("WorkerPaymentService: Saving worker payment", {
                organizationId,
                jobCount: jobIds.length,
            });

            const { data, error } = await supabase.functions.invoke(
                "save-worker-payment",
                {
                    body: {
                        organization_id: organizationId,
                        calculation: calculation.calculation,
                        job_ids: jobIds,
                    },
                },
            );

            if (error) throw error;

            if (!data || !data.success) {
                throw new Error("Failed to save worker payment");
            }

            return {
                success: true,
                batch_id: data.batch_id,
            };
        } catch (err) {
            log.error(
                "WorkerPaymentService: Failed to save worker payment",
                {
                    error: err instanceof Error ? err.message : "Unknown error",
                },
            );
            throw err;
        }
    }
}
