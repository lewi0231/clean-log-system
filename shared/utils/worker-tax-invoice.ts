/**
 * Pure helpers for worker tax-invoice eligibility and status rules.
 * Canonical for dashboard tests. Deno Edge copy lives at
 * database/supabase/functions/_utils/worker-tax-invoice.ts (must stay in sync —
 * Edge runtime cannot import outside functions/).
 */

export const MAX_TAX_INVOICE_JOBS = 100;

export const ACTIVE_TI_STATUSES = ["draft", "submitted", "approved", "paid"] as const;
export type ActiveTaxInvoiceStatus = (typeof ACTIVE_TI_STATUSES)[number];

export const CANCELLABLE_TI_STATUSES = ["draft", "submitted", "approved"] as const;

export function isActiveTaxInvoiceStatus(status: string): boolean {
  return (ACTIVE_TI_STATUSES as readonly string[]).includes(status);
}

export function canCancelTaxInvoiceStatus(status: string): boolean {
  return (CANCELLABLE_TI_STATUSES as readonly string[]).includes(status);
}

/**
 * Deduplicate and validate job id list for draft/submit.
 * Returns normalized ids or an error message.
 */
export function normalizeTaxInvoiceJobIds(
  jobIds: unknown
): { ok: true; jobIds: string[] } | { ok: false; message: string } {
  if (!Array.isArray(jobIds)) {
    return { ok: false, message: "job_ids must be an array" };
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of jobIds) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return { ok: false, message: "job_ids must be non-empty strings" };
    }
    const id = raw.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  if (normalized.length === 0) {
    return { ok: false, message: "Select at least one job" };
  }
  if (normalized.length > MAX_TAX_INVOICE_JOBS) {
    return { ok: false, message: `At most ${MAX_TAX_INVOICE_JOBS} jobs per tax invoice` };
  }
  return { ok: true, jobIds: normalized };
}

export type TaxInvoiceConflictCandidate = {
  job_id: string;
  invoice_id: string;
  worker_id: string;
  status: string;
};

/** Pure conflict filter used after DB fetch (testable). */
export function filterActiveTaxInvoiceConflicts(
  candidates: TaxInvoiceConflictCandidate[],
  workerId: string,
  excludeInvoiceId?: string
): string[] {
  const conflicts: string[] = [];
  for (const row of candidates) {
    if (row.worker_id !== workerId) continue;
    if (excludeInvoiceId && row.invoice_id === excludeInvoiceId) continue;
    if (isActiveTaxInvoiceStatus(row.status)) {
      conflicts.push(row.job_id);
    }
  }
  return conflicts;
}

/** Round money the same way draft/submit lines do. */
export function roundTaxInvoiceAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}
