/**
 * Auto-approve colleague-pending jobs whose auto_approve_at has passed.
 * Used by the scheduled auto-approve-jobs function and opportunistically
 * by list endpoints so expired jobs do not stay "pending" when cron is idle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { autoGenerateInvoiceForJob } from "./auto-invoice.ts";
import { createLoggerWithoutRequest } from "./logger.ts";
import { createNotification } from "./notifications.ts";

export type AutoApproveExpiredJobsResult = {
  jobsApproved: number;
  jobIds: string[];
};

export type AutoApproveExpiredJobsOptions = {
  /** Limit to these job IDs (optional). */
  jobIds?: string[];
  now?: Date;
  /** When false, skip notifications + auto-invoice (faster opportunistic path). Default true. */
  sideEffects?: boolean;
};

/**
 * Approve jobs with approval_status=pending and auto_approve_at <= now.
 * Also marks pending job_worker rows as confirmed.
 */
export async function autoApproveExpiredJobs(
  supabase: SupabaseClient,
  options: AutoApproveExpiredJobsOptions = {}
): Promise<AutoApproveExpiredJobsResult> {
  const logger = createLoggerWithoutRequest({
    functionName: "autoApproveExpiredJobs",
  });
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const sideEffects = options.sideEffects !== false;

  let query = supabase
    .from("job")
    .select(
      `
      id,
      organization_id,
      location_id,
      submitted_by_worker_id,
      location:location_id (name)
    `
    )
    .eq("approval_status", "pending")
    .lte("auto_approve_at", nowIso)
    .not("auto_approve_at", "is", null);

  if (options.jobIds && options.jobIds.length > 0) {
    query = query.in("id", options.jobIds);
  }

  const { data: jobsToApprove, error: fetchError } = await query;

  if (fetchError) {
    logger.error("Error fetching jobs to auto-approve", fetchError);
    throw fetchError;
  }

  if (!jobsToApprove || jobsToApprove.length === 0) {
    return { jobsApproved: 0, jobIds: [] };
  }

  const jobIds = jobsToApprove.map((j) => j.id);

  const { error: jobUpdateError } = await supabase
    .from("job")
    .update({ approval_status: "approved" })
    .in("id", jobIds)
    .eq("approval_status", "pending");

  if (jobUpdateError) {
    logger.error("Error updating job status", jobUpdateError);
    throw jobUpdateError;
  }

  const { error: workerUpdateError } = await supabase
    .from("job_worker")
    .update({
      confirmation_status: "confirmed",
      confirmed_at: nowIso,
    })
    .in("job_id", jobIds)
    .eq("confirmation_status", "pending");

  if (workerUpdateError) {
    logger.warn("Error updating job_worker status after auto-approve", {
      error: workerUpdateError.message,
    });
  }

  if (sideEffects) {
    for (const job of jobsToApprove) {
      const locationRow = Array.isArray(job.location) ? job.location[0] : job.location;
      const locationName =
        locationRow && typeof locationRow === "object" && "name" in locationRow
          ? String((locationRow as { name: string | null }).name || "Unknown location")
          : "Unknown location";

      try {
        await createNotification(supabase, {
          organization_id: job.organization_id,
          type: "job_auto_approved",
          title: "Job Auto-Approved",
          message: `A job at ${locationName} was automatically approved after the confirmation timeout.`,
          related_entity_type: "job",
          related_entity_id: job.id,
        });
      } catch (notificationError) {
        logger.warn("Error sending auto-approve notification", {
          jobId: job.id,
          error: notificationError instanceof Error ? notificationError.message : "Unknown error",
        });
      }

      try {
        const autoInvoiceResult = await autoGenerateInvoiceForJob({
          jobId: job.id,
          organizationId: job.organization_id,
          locationId: job.location_id,
          supabaseAdmin: supabase,
          logger,
        });
        if (autoInvoiceResult.skipped) {
          logger.debug("Auto-invoice skipped for auto-approved job", {
            jobId: job.id,
            reason: autoInvoiceResult.skipReason,
          });
        } else if (!autoInvoiceResult.success) {
          logger.warn("Auto-invoice failed for auto-approved job", {
            jobId: job.id,
            error: autoInvoiceResult.error,
          });
        }
      } catch (invoiceErr) {
        logger.warn("Auto-invoice error for auto-approved job", {
          jobId: job.id,
          error: invoiceErr,
        });
      }
    }
  }

  logger.info("Auto-approve completed", { jobsApproved: jobIds.length });
  return { jobsApproved: jobIds.length, jobIds };
}

/** Pure helper: keep only confirmations that are still within the confirmation window. */
export function filterActivePendingConfirmations<T extends { auto_approve_at?: string | null }>(
  items: T[],
  now: Date = new Date()
): T[] {
  const nowMs = now.getTime();
  return items.filter((item) => {
    if (!item.auto_approve_at) return true;
    return new Date(item.auto_approve_at).getTime() > nowMs;
  });
}
