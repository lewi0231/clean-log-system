import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { canMarkBatchAsPaidFromStatus } from "@/lib/worker-payments/payment-history-settlement-badge";

/**
 * Batches are attributed to a pay period using the latest job completion in the run
 * (`dateRange.end`). This matches "what work this pay run covers" better than
 * `calculatedAt` alone.
 */
export function getBatchAnchorDate(p: PaymentRecord): Date {
  return new Date(p.dateRange.end);
}

export function isUnpaidPayRun(p: PaymentRecord): boolean {
  if (!p.batch_id) return false;
  return canMarkBatchAsPaidFromStatus(p.status);
}

/** `arrears` = anchor before current window; `current` = anchor on/after current start (includes work dated after `current.to` — rare; shown with current). */
export function classifyBatchPayPeriod(
  p: PaymentRecord,
  current: { from: Date; to: Date }
): "arrears" | "current" {
  const t = getBatchAnchorDate(p).getTime();
  if (t < current.from.getTime()) return "arrears";
  return "current";
}
