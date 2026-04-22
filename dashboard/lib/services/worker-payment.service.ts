import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";

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

export interface PaymentRecord {
  id: string;
  batch_id?: string; // Database batch ID for status updates
  dateRange: { start: string; end: string };
  jobIds: string[];
  totalPayment: number;
  workerCount: number;
  calculation: CalculateWorkerPaymentsResponse;
  calculatedAt: string;
  status?: "calculated" | "approved" | "processing" | "paid" | "failed" | "cancelled"; // Payment batch status
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
    request: CalculateWorkerPaymentsRequest
  ): Promise<CalculateWorkerPaymentsResponse> {
    try {
      log.debug("WorkerPaymentService: Calculating worker payments", {
        organizationId: request.organization_id,
        jobCount: request.job_ids.length,
      });

      const data = await invokeEdgeFunction<CalculateWorkerPaymentsResponse>(
        "calculate-worker-payment",
        request as unknown as Record<string, unknown>
      );

      if (!data || !data.success) {
        throw new Error("Failed to calculate worker payments");
      }

      return data as CalculateWorkerPaymentsResponse;
    } catch (err) {
      log.error("WorkerPaymentService: Failed to calculate worker payments", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Export payment calculations to CSV format
   */
  static exportPaymentsToCSV(
    payment: PaymentRecord,
    jobs: Array<{ id: string; workers: Array<{ name: string }> }>
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
    }>
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

    return Array.from(workerMap.values()).sort((a, b) => b.totalPayment - a.totalPayment);
  }

  /**
   * Filter payment records by date range
   */
  static filterByDateRange(
    payments: PaymentRecord[],
    startDate?: string,
    endDate?: string
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
    }>
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
    jobIds: string[]
  ): Promise<{ success: boolean; batch_id: string }> {
    try {
      log.debug("WorkerPaymentService: Saving worker payment", {
        organizationId,
        jobCount: jobIds.length,
      });

      const data = await invokeEdgeFunction<{
        success?: boolean;
        batch_id?: string;
      }>("save-worker-payment", {
        organization_id: organizationId,
        calculation: calculation.calculation,
        job_ids: jobIds,
      });

      if (!data || !data.success) {
        throw new Error("Failed to save worker payment");
      }

      return {
        success: true,
        batch_id: data.batch_id as string,
      };
    } catch (err) {
      log.error("WorkerPaymentService: Failed to save worker payment", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Update worker payment status (mark as paid, approved, etc.)
   */
  static async updatePaymentStatus(
    organizationId: string,
    params: {
      paymentId?: string;
      batchId?: string;
      status: "calculated" | "approved" | "processing" | "paid" | "failed" | "cancelled";
      paymentMethod?: "bank_transfer" | "cash" | "check" | "payroll_system" | "other";
      paymentReference?: string;
      paymentDate?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean }> {
    try {
      // Don't log payment references / notes.
      log.debug("WorkerPaymentService: Updating payment status", {
        organizationId,
        paymentId: params.paymentId,
        batchId: params.batchId,
        status: params.status,
        paymentMethod: params.paymentMethod,
        hasPaymentReference: !!params.paymentReference,
        hasNotes: !!params.notes,
      });

      const data = await invokeEdgeFunction<{ success?: boolean }>("update-worker-payment-status", {
        organization_id: organizationId,
        payment_id: params.paymentId,
        batch_id: params.batchId,
        status: params.status,
        payment_method: params.paymentMethod,
        payment_reference: params.paymentReference,
        payment_date: params.paymentDate,
        notes: params.notes,
      });

      if (!data || !data.success) {
        throw new Error("Failed to update payment status");
      }

      return {
        success: true,
      };
    } catch (err) {
      log.error("WorkerPaymentService: Failed to update payment status", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * List worker payment history from database
   * Fetches payment batches with pagination support
   */
  static async listPayments(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{ payments: PaymentRecord[]; total: number; hasMore: boolean }> {
    try {
      log.debug("WorkerPaymentService: Listing worker payments", {
        organizationId,
        ...options,
      });

      const data = await invokeEdgeFunction<{
        success?: boolean;
        batches?: PaymentRecord[];
        total?: number;
        hasMore?: boolean;
      }>("list-worker-payments", {
        organization_id: organizationId,
        page: options?.page ?? 1,
        limit: options?.limit ?? 50,
      });

      if (!data || !data.success) {
        throw new Error("Failed to list worker payments");
      }

      return {
        payments: data.batches as PaymentRecord[],
        total: data.total ?? data.batches?.length ?? 0,
        hasMore: data.hasMore ?? false,
      };
    } catch (err) {
      log.error("WorkerPaymentService: Failed to list worker payments", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
