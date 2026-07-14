import { log } from "@/lib/logger";
import { invokeEdgeFunction, invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { Job } from "@/lib/types";
import {
  buildWorkerTotalsCsv,
  getCurrencyMinorUnitFactor,
  type BatchWorkerPaymentRow,
  reconcileBatchTotal,
  rollupByWorkerId,
} from "@/lib/worker-payments/export-batch-worker-csv";
import type {
  CalculateWorkerPaymentsRequest,
  CalculateWorkerPaymentsResponse,
  WorkerPaymentCalculation,
} from "@/lib/types/worker-payment-edge";

export type {
  AppliedRule,
  CalculateWorkerPaymentsRequest,
  CalculateWorkerPaymentsResponse,
  WorkerPaymentCalculation,
  WorkerPaymentLineItem,
  WorkerPaymentSplit,
} from "@/lib/types/worker-payment-edge";

/** Hint when a job already has an open (unpaid) payment row — user may confirm replace. */
export interface SaveWorkerPaymentDuplicateHint {
  job_id: string;
  batch_id: string;
  batch_status: string;
  calculated_at: string;
}

/** Hint when a job is tied to a completed (paid) batch — save is blocked until adjustment workflow ships. */
export interface SaveWorkerPaymentBlockedHint {
  job_id: string;
  batch_id: string;
  batch_status: string;
  calculated_at: string;
}

export type SaveWorkerPaymentResult =
  | {
      ok: true;
      batch_id: string;
      payment_count?: number;
      replaced?: { jobs_replaced: number; batches_cancelled: number };
    }
  | {
      ok: false;
      error_code: "duplicate_payments_needs_confirm";
      duplicates: SaveWorkerPaymentDuplicateHint[];
    }
  | { ok: false; error_code: "jobs_already_paid"; blocked_jobs: SaveWorkerPaymentBlockedHint[] };

export type { BatchWorkerPaymentRow } from "@/lib/worker-payments/export-batch-worker-csv";

/**
 * A payment batch as returned by `list-worker-payments`. Nested `worker_payment` rows
 * use the `payments` field (per-worker line items; not to be confused with the outer
 * `listPayments` return, whose `payments` key is the list of *batches* from `data.batches`).
 */
export interface PaymentRecord {
  id: string;
  batch_id?: string; // Database batch ID for status updates; same as `id` when from API
  dateRange: { start: string; end: string };
  jobIds: string[];
  totalPayment: number;
  workerCount: number;
  calculation: CalculateWorkerPaymentsResponse;
  calculatedAt: string;
  /** Batch status from `worker_payment_batch` (`completed` = marked paid; line items use `paid`). */
  status?: "calculated" | "approved" | "processing" | "completed" | "paid" | "failed" | "cancelled";
  /** Batch-level currency (ISO 4217) when present. */
  currency?: string;
  /**
   * Per-row `worker_payment` records (API key `payments` on the batch), each with
   * `amount`, `job_id`, `worker_id`, and `calculation_details`.
   */
  payments?: BatchWorkerPaymentRow[];
}

/** Batch ready for per-worker handoff export: has line items and currency. */
export type LoadedPaymentBatch = PaymentRecord & {
  payments: BatchWorkerPaymentRow[];
  currency: string;
};

export function isLoadedPaymentBatch(p: PaymentRecord): p is LoadedPaymentBatch {
  return (
    Array.isArray(p.payments) &&
    p.payments.length > 0 &&
    typeof p.currency === "string" &&
    p.currency.length > 0
  );
}

export interface WorkerSummary {
  workerId: string;
  workerName: string;
  jobCount: number;
  totalPayment: number;
  averagePayment: number;
  jobs: string[];
}

/** Same as {@link WorkerSummary} with batch keys for “Mark as paid” in Summary. */
export interface WorkerSummaryWithBatches extends WorkerSummary {
  /** `batch_id` from API, deduped, for `MarkPaymentPaidDialog`. */
  sourceBatchKeys: string[];
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

      const data = await invokeTypedEdge("calculate-worker-payment", request);

      if (!data || !data.success) {
        throw new Error("Failed to calculate worker payments");
      }

      return data;
    } catch (err) {
      log.error("WorkerPaymentService: Failed to calculate worker payments", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Job-level (coarse) export — one row per job, not per-worker split rows.
   * // Renamed from exportPaymentsToCSV 2026-04
   */
  static exportJobLevelPaymentsToCsv(
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

  private static formatAmountForCurrency(amount: number, currency: string): string {
    const factor = getCurrencyMinorUnitFactor(currency);
    const decimals = factor >= 100 ? 2 : 0;
    return amount.toFixed(decimals);
  }

  /**
   * Resolve `worker_name` for export: prefer `worker_splits` in saved calculation, else job `workers`.
   */
  static resolveWorkerNameForExport(payment: PaymentRecord, workerId: string, jobs: Job[]): string {
    const jcs = payment.calculation?.calculation?.job_calculations;
    if (jcs) {
      for (const jc of jcs) {
        const splits = jc.worker_splits;
        if (splits) {
          const hit = splits.find((w) => w.worker_id === workerId);
          if (hit?.worker_name) return hit.worker_name;
        }
      }
    }
    for (const job of jobs) {
      const w = job.workers?.find((x) => x.id === workerId);
      if (w?.name) return w.name;
    }
    return "";
  }

  /**
   * Per-worker roll-up handoff CSV (UTF-8). Caller should prepend `\uFEFF` for Excel if desired.
   * @throws If batch has no line items, or reconciliation fails (do not download).
   */
  static exportBatchWorkerSummaryToCsv(
    payment: PaymentRecord,
    options: { organizationId: string; jobs: Job[]; now?: Date }
  ): string {
    if (!payment.payments?.length) {
      throw new Error("EXPORT_NO_LINE_ITEMS");
    }

    const currency = (
      payment.currency?.trim() ||
      payment.payments[0]?.currency ||
      "AUD"
    ).toUpperCase();
    const { organizationId, jobs, now = new Date() } = options;
    const batchId = payment.batch_id ?? payment.id;

    const { ok, deltaMinorUnits } = reconcileBatchTotal(
      payment.totalPayment,
      payment.payments,
      currency
    );
    if (!ok) {
      throw new Error(`RECONCILE_FAIL: batch ${batchId} delta_minor=${deltaMinorUnits}`);
    }

    const roll = rollupByWorkerId(payment.payments);
    const exportAt = now.toISOString();
    const calculatedAt = payment.calculatedAt;

    const sWorkers = [...roll.values()].reduce((a, b) => a + b.total, 0);
    const dataRows = [...roll.values()]
      .sort((a, b) => a.workerId.localeCompare(b.workerId))
      .map((r) => ({
        batch_id: batchId,
        organization_id: organizationId,
        currency,
        worker_id: r.workerId,
        worker_name: WorkerPaymentService.resolveWorkerNameForExport(payment, r.workerId, jobs),
        total_for_batch: WorkerPaymentService.formatAmountForCurrency(r.total, currency),
        job_count_in_batch: String(r.jobIds.size),
        hours_worked: r.hoursWorked % 1 === 0 ? String(r.hoursWorked) : r.hoursWorked.toFixed(2),
        split_mode: r.splitMode,
        calculated_at: calculatedAt,
        export_generated_at: exportAt,
      }));

    const body = buildWorkerTotalsCsv({
      batchId,
      organizationId,
      currency,
      calculatedAt,
      exportGeneratedAt: exportAt,
      dataRows,
      reconciliation: {
        tBatch: payment.totalPayment,
        sWorkers,
        ok: true,
      },
    });
    // UTF-8 BOM for Excel double-click on Windows
    return `\uFEFF${body}`;
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
   * Like {@link aggregateByWorker} but tracks which pay runs contributed to each row.
   */
  static aggregateByWorkerWithBatches(
    payments: PaymentRecord[],
    jobs: Array<{
      id: string;
      workers: Array<{ id: string; name: string }>;
    }>
  ): WorkerSummaryWithBatches[] {
    const workerMap = new Map<string, WorkerSummaryWithBatches & { _batchSet: Set<string> }>();

    const addJobForWorker = (
      worker: { id: string; name: string },
      calc: WorkerPaymentCalculation,
      payment: PaymentRecord
    ) => {
      const batchKey = payment.batch_id ?? payment.id;
      const existing = workerMap.get(worker.id);
      if (existing) {
        existing.jobCount += 1;
        existing.totalPayment += calc.total_worker_payment;
        existing.jobs.push(calc.job_id);
        existing._batchSet.add(batchKey);
      } else {
        const s = new Set<string>([batchKey]);
        workerMap.set(worker.id, {
          workerId: worker.id,
          workerName: worker.name,
          jobCount: 1,
          totalPayment: calc.total_worker_payment,
          averagePayment: calc.total_worker_payment,
          jobs: [calc.job_id],
          sourceBatchKeys: [],
          _batchSet: s,
        });
      }
    };

    payments.forEach((payment) => {
      payment.calculation.calculation.job_calculations.forEach((calc) => {
        const job = jobs.find((j) => j.id === calc.job_id);
        if (!job) return;
        job.workers.forEach((worker) => {
          addJobForWorker(worker, calc, payment);
        });
      });
    });

    const out: WorkerSummaryWithBatches[] = [];
    workerMap.forEach((w) => {
      w.averagePayment = w.totalPayment / w.jobCount;
      w.sourceBatchKeys = Array.from(w._batchSet);
      const { _batchSet: _, ...rest } = w;
      out.push(rest);
    });

    return out.sort((a, b) => b.totalPayment - a.totalPayment);
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
   * Save worker payment calculation to database.
   * When unpaid duplicates exist for the same jobs, first call returns `{ ok: false, error_code: duplicate_payments_needs_confirm }`; retry with `{ replaceExisting: true }`.
   */
  static async savePayment(
    organizationId: string,
    calculation: CalculateWorkerPaymentsResponse,
    jobIds: string[],
    options?: { replaceExisting?: boolean }
  ): Promise<SaveWorkerPaymentResult> {
    try {
      log.debug("WorkerPaymentService: Saving worker payment", {
        organizationId,
        jobCount: jobIds.length,
        replaceExisting: Boolean(options?.replaceExisting),
      });

      const data = await invokeEdgeFunction<{
        success?: boolean;
        batch_id?: string;
        payment_count?: number;
        error_code?: string;
        duplicates?: SaveWorkerPaymentDuplicateHint[];
        blocked_jobs?: SaveWorkerPaymentBlockedHint[];
        replaced?: { jobs_replaced: number; batches_cancelled: number };
      }>("save-worker-payment", {
        organization_id: organizationId,
        calculation: calculation.calculation,
        job_ids: jobIds,
        replace_existing: options?.replaceExisting === true ? true : undefined,
      });

      if (!data) {
        throw new Error("Failed to save worker payment");
      }

      if (data.success === false) {
        if (
          data.error_code === "duplicate_payments_needs_confirm" &&
          Array.isArray(data.duplicates)
        ) {
          return {
            ok: false,
            error_code: "duplicate_payments_needs_confirm",
            duplicates: data.duplicates,
          };
        }
        if (data.error_code === "jobs_already_paid" && Array.isArray(data.blocked_jobs)) {
          return {
            ok: false,
            error_code: "jobs_already_paid",
            blocked_jobs: data.blocked_jobs,
          };
        }
        throw new Error("Failed to save worker payment");
      }

      return {
        ok: true,
        batch_id: data.batch_id as string,
        payment_count: data.payment_count,
        replaced: data.replaced,
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

      // Edge function returns `batches: PaymentRecord[]` — we expose them as `payments` here.
      // Each batch may include `payments: BatchWorkerPaymentRow[]` (worker_payment rows).
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

  /**
   * Send remittance email to a worker.
   * S2 §5: Payment recording is primary; email failure does NOT roll back paid status.
   */
  static async sendRemittanceEmail(
    organizationId: string,
    params: {
      workerEmail: string;
      workerName: string;
      periodLabel: string;
      currency: string;
      lines: Array<{
        jobName: string;
        amount: number;
        paidAt: string | null;
        paymentReference: string | null;
        poolWeight?: number | null;
        hoursWorked?: number | null;
      }>;
      paymentMethod?: string | null;
      paymentReference?: string | null;
      paymentDate?: string | null;
      totalAmount: number;
    }
  ): Promise<{ ok: boolean; emailId?: string; code?: string; message?: string }> {
    try {
      log.debug("WorkerPaymentService: Sending remittance email", {
        organizationId,
        workerEmail: params.workerEmail,
        lineCount: params.lines.length,
      });

      const data = await invokeEdgeFunction<{
        ok?: boolean;
        emailId?: string;
        code?: string;
        message?: string;
      }>("send-worker-remittance-email", {
        organization_id: organizationId,
        worker_email: params.workerEmail,
        worker_name: params.workerName,
        period_label: params.periodLabel,
        currency: params.currency,
        lines: params.lines.map((l) => ({
          jobName: l.jobName,
          amount: l.amount,
          paidAt: l.paidAt,
          paymentReference: l.paymentReference,
          pool_weight: l.poolWeight ?? null,
          hours_worked: l.hoursWorked ?? null,
        })),
        payment_method: params.paymentMethod,
        payment_reference: params.paymentReference,
        payment_date: params.paymentDate,
        total_amount: params.totalAmount,
      });

      if (!data) {
        return { ok: false, code: "NO_RESPONSE", message: "No response from server" };
      }

      return {
        ok: data.ok ?? false,
        emailId: data.emailId,
        code: data.code,
        message: data.message,
      };
    } catch (err) {
      log.error("WorkerPaymentService: Failed to send remittance email", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return {
        ok: false,
        code: "ERROR",
        message: err instanceof Error ? err.message : "Failed to send email",
      };
    }
  }
}
