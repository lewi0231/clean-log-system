/**
 * Worker tax invoice helpers for Deno Edge Functions.
 * Pure rules keep in sync with shared/utils/worker-tax-invoice.ts
 * (Edge runtime cannot import files outside database/supabase/functions/).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_TAX_INVOICE_JOBS = 100;
export const ACTIVE_TI_STATUSES = ["draft", "submitted", "approved", "paid"] as const;
export const CANCELLABLE_TI_STATUSES = ["draft", "submitted", "approved"] as const;

export function isActiveTaxInvoiceStatus(status: string): boolean {
  return (ACTIVE_TI_STATUSES as readonly string[]).includes(status);
}

export function canCancelTaxInvoiceStatus(status: string): boolean {
  return (CANCELLABLE_TI_STATUSES as readonly string[]).includes(status);
}

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

export function roundTaxInvoiceAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export async function assertJobsEligibleForWorker(
  supabase: SupabaseClient,
  organizationId: string,
  workerId: string,
  jobIds: string[]
): Promise<{ ok: true; jobIds: string[] } | { ok: false; message: string }> {
  const normalized = normalizeTaxInvoiceJobIds(jobIds);
  if (!normalized.ok) return normalized;
  const ids = normalized.jobIds;

  const { data: jobs, error: jobsErr } = await supabase
    .from("job")
    .select("id, organization_id, approval_status")
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (jobsErr) throw jobsErr;
  if (!jobs || jobs.length !== ids.length) {
    return { ok: false, message: "One or more jobs were not found" };
  }
  for (const job of jobs) {
    if (job.approval_status !== "approved") {
      return {
        ok: false,
        message: "Only approved jobs can be included on a tax invoice",
      };
    }
  }

  const { data: jws, error: jwErr } = await supabase
    .from("job_worker")
    .select("job_id, confirmation_status")
    .eq("worker_id", workerId)
    .in("job_id", ids);

  if (jwErr) throw jwErr;
  const byJob = new Map((jws || []).map((j) => [j.job_id, j.confirmation_status]));
  for (const jobId of ids) {
    if (!byJob.has(jobId)) {
      return { ok: false, message: "You are not assigned to one or more selected jobs" };
    }
    if (byJob.get(jobId) === "flagged") {
      return { ok: false, message: "Flagged job participation cannot be invoiced" };
    }
  }

  return { ok: true, jobIds: ids };
}

export async function findActiveTaxInvoiceConflicts(
  supabase: SupabaseClient,
  workerId: string,
  jobIds: string[],
  excludeInvoiceId?: string
): Promise<string[]> {
  if (jobIds.length === 0) return [];

  const { data: lines, error } = await supabase
    .from("worker_tax_invoice_line")
    .select("job_id, invoice_id, worker_tax_invoice!inner(id, worker_id, status)")
    .in("job_id", jobIds);

  if (error) throw error;

  const candidates = (lines || []).map((line) => {
    const inv = line.worker_tax_invoice as unknown as {
      id: string;
      worker_id: string;
      status: string;
    };
    return {
      job_id: line.job_id as string,
      invoice_id: inv.id,
      worker_id: inv.worker_id,
      status: inv.status,
    };
  });

  return filterActiveTaxInvoiceConflicts(candidates, workerId, excludeInvoiceId);
}
