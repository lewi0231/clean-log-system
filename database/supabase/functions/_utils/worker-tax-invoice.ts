/**
 * Shared helpers for worker tax invoice eligibility and active-line checks.
 * Pure rules live in shared/utils/worker-tax-invoice.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterActiveTaxInvoiceConflicts,
  normalizeTaxInvoiceJobIds,
  MAX_TAX_INVOICE_JOBS,
  ACTIVE_TI_STATUSES,
  canCancelTaxInvoiceStatus,
  isActiveTaxInvoiceStatus,
  roundTaxInvoiceAmount,
} from "../../../shared/utils/worker-tax-invoice.ts";

export {
  MAX_TAX_INVOICE_JOBS,
  ACTIVE_TI_STATUSES,
  canCancelTaxInvoiceStatus,
  isActiveTaxInvoiceStatus,
  normalizeTaxInvoiceJobIds,
  filterActiveTaxInvoiceConflicts,
  roundTaxInvoiceAmount,
};

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
