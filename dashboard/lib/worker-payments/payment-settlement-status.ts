/**
 * Derive settlement badge for a batch or worker's lines within a batch.
 * S2 §4.2: 0 < paidLines < totalLines → "Partial"
 */
import type { BatchWorkerPaymentRow } from "./export-batch-worker-csv";

export type SettlementStatus = "none" | "partial" | "complete";

/**
 * Derives settlement status from payment lines.
 */
export function getSettlementStatus(
  payments: BatchWorkerPaymentRow[] | undefined
): SettlementStatus {
  if (!payments?.length) return "none";

  const paidCount = payments.filter((p) => p.status === "paid").length;
  const total = payments.length;

  if (paidCount === 0) return "none";
  if (paidCount === total) return "complete";
  return "partial";
}

/**
 * Derives settlement status for a specific worker within a batch.
 */
export function getWorkerSettlementStatus(
  payments: BatchWorkerPaymentRow[] | undefined,
  workerId: string
): SettlementStatus {
  if (!payments?.length) return "none";

  const workerPayments = payments.filter((p) => p.worker_id === workerId);
  return getSettlementStatus(workerPayments);
}

/**
 * Returns counts for display: { paid, total }
 */
export function getSettlementCounts(payments: BatchWorkerPaymentRow[] | undefined): {
  paid: number;
  total: number;
} {
  if (!payments?.length) return { paid: 0, total: 0 };

  const paid = payments.filter((p) => p.status === "paid").length;
  return { paid, total: payments.length };
}

/**
 * Returns counts for a specific worker within a batch.
 */
export function getWorkerSettlementCounts(
  payments: BatchWorkerPaymentRow[] | undefined,
  workerId: string
): { paid: number; total: number } {
  if (!payments?.length) return { paid: 0, total: 0 };

  const workerPayments = payments.filter((p) => p.worker_id === workerId);
  return getSettlementCounts(workerPayments);
}
