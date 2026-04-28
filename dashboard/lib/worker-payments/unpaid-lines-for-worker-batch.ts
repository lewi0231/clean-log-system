/**
 * Filter and extract unpaid payment lines for a specific worker in a batch.
 * S2 §4.1: selectable lines = status !== 'paid' && status !== 'cancelled'
 */
import type { BatchWorkerPaymentRow } from "./export-batch-worker-csv";

/** Statuses that are NOT selectable for marking as paid. */
const NON_SELECTABLE_STATUSES = new Set(["paid", "cancelled"]);

/**
 * Returns only the unpaid (selectable) lines for a given worker in the batch.
 */
export function unpaidLinesForWorkerBatch(
  payments: BatchWorkerPaymentRow[] | undefined,
  workerId: string
): BatchWorkerPaymentRow[] {
  if (!payments?.length) return [];
  return payments.filter((p) => p.worker_id === workerId && !NON_SELECTABLE_STATUSES.has(p.status));
}

/**
 * Returns the count of paid lines for a worker in the batch.
 */
export function paidLinesCountForWorkerBatch(
  payments: BatchWorkerPaymentRow[] | undefined,
  workerId: string
): number {
  if (!payments?.length) return 0;
  return payments.filter((p) => p.worker_id === workerId && p.status === "paid").length;
}

/**
 * Returns the total count of lines for a worker in the batch.
 */
export function totalLinesCountForWorkerBatch(
  payments: BatchWorkerPaymentRow[] | undefined,
  workerId: string
): number {
  if (!payments?.length) return 0;
  return payments.filter((p) => p.worker_id === workerId).length;
}
