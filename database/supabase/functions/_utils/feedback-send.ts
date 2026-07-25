/**
 * Shared feedback request enqueue/send helper.
 * Used by create-job, admin-create-job, send-feedback-email, and outbox poller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FeedbackEmailData,
  type FeedbackRequestMode,
  generateFeedbackToken,
  getFeedbackEmailRecipient,
  sendFeedbackRequestEmail,
} from "./feedback-email.ts";
import type { InvoiceEmailRecipientConfig, JobContext } from "./invoice-email.ts";
import { createLoggerWithoutRequest } from "./logger.ts";

const MAX_ATTEMPTS = 5;

export type FeedbackSendPath = "auto" | "manual";

export interface EnqueueOrSendOptions {
  path: FeedbackSendPath;
  confirmFlagged?: boolean;
  confirmTest?: boolean;
  confirmResend?: boolean;
  isResend?: boolean;
  now?: Date;
}

export interface EnqueueOrSendResult {
  ok: boolean;
  skipped?: boolean;
  queued?: boolean;
  sent?: boolean;
  cancelled?: boolean;
  reason?: string;
  error_code?: string;
  emailId?: string;
  outboxId?: string;
  status?: string;
}

export interface OrgFeedbackConfig {
  name: string | null;
  locale: string | null;
  feedback_requests_enabled: boolean;
  feedback_auto_send: boolean;
  feedback_request_mode: FeedbackRequestMode;
  public_review_url: string | null;
  feedback_email_subject: string | null;
  feedback_email_body: string | null;
  feedback_email_reply_to: string | null;
  feedback_send_delay_hours: number;
}

export function computeSendAfter(params: {
  completedAt: string | null;
  createdAt: string | null;
  editWindowExpiresAt: string | null;
  delayHours: number;
}): Date {
  const baseIso = params.completedAt || params.createdAt;
  const base = baseIso ? new Date(baseIso) : new Date();
  const delayMs = Math.max(0, params.delayHours) * 60 * 60 * 1000;
  const delayEnd = new Date(base.getTime() + delayMs);
  if (params.editWindowExpiresAt) {
    const windowEnd = new Date(params.editWindowExpiresAt);
    return windowEnd.getTime() > delayEnd.getTime() ? windowEnd : delayEnd;
  }
  return delayEnd;
}

function backoffMinutes(attempts: number): number {
  return Math.min(2 ** Math.max(attempts, 1), 60);
}

function isHttpsUrl(url: string | null | undefined): boolean {
  return !!url && /^https:\/\//i.test(url.trim());
}

type JobRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  submission_data: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string | null;
  edit_window_expires_at: string | null;
  is_test: boolean | null;
  approval_status: string | null;
  feedback_token: string | null;
  feedback_email_sent: boolean | null;
  feedback_email_sent_at: string | null;
  location: unknown;
};

async function loadOrg(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgFeedbackConfig | null> {
  const { data, error } = await supabase
    .from("organization")
    .select(
      "name, locale, feedback_requests_enabled, feedback_auto_send, feedback_request_mode, public_review_url, feedback_email_subject, feedback_email_body, feedback_email_reply_to, feedback_send_delay_hours"
    )
    .eq("id", organizationId)
    .single();
  if (error || !data) return null;
  return data as OrgFeedbackConfig;
}

async function loadJob(supabase: SupabaseClient, jobId: string): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("job")
    .select(
      `
      id,
      organization_id,
      location_id,
      submission_data,
      completed_at,
      created_at,
      edit_window_expires_at,
      is_test,
      approval_status,
      feedback_token,
      feedback_email_sent,
      feedback_email_sent_at,
      location:location_id (
        id,
        email,
        contact_person,
        name,
        hierarchy_parent_id,
        feedback_requests_enabled
      )
    `
    )
    .eq("id", jobId)
    .single();
  if (error || !data) return null;
  return data as unknown as JobRow;
}

function unwrapLocation(location: unknown): {
  id: string;
  email: string | null;
  contact_person: string | null;
  name: string | null;
  hierarchy_parent_id: string | null;
  feedback_requests_enabled: boolean;
} | null {
  const loc = Array.isArray(location) ? location[0] : location;
  if (!loc || typeof loc !== "object") return null;
  const row = loc as Record<string, unknown>;
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    contact_person: (row.contact_person as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    hierarchy_parent_id: (row.hierarchy_parent_id as string | null) ?? null,
    feedback_requests_enabled: row.feedback_requests_enabled !== false,
  };
}

async function resolveRecipient(
  supabase: SupabaseClient,
  job: JobRow,
  locationData: ReturnType<typeof unwrapLocation>
): Promise<string | null> {
  const { data: templateConfig } = await supabase
    .from("invoice_template_config")
    .select("email_recipient_config")
    .eq("organization_id", job.organization_id)
    .maybeSingle();

  const emailConfig: InvoiceEmailRecipientConfig =
    (templateConfig?.email_recipient_config as InvoiceEmailRecipientConfig) || {
      location_email_source: "location_email",
      form_field_email: null,
      default_email: null,
    };

  const { data: fieldConfigs } = await supabase
    .from("organization_field_configs")
    .select("id, name")
    .eq("organization_id", job.organization_id)
    .eq("active", true);

  const fieldConfigMap = new Map<string, { name: string }>(
    (fieldConfigs || []).map((fc: { id: string; name: string }) => [fc.id, { name: fc.name }])
  );

  const jobContext: JobContext = {
    location_id: job.location_id,
    location: locationData
      ? {
          id: locationData.id,
          email: locationData.email,
          contact_person: locationData.contact_person,
          hierarchy_parent_id: locationData.hierarchy_parent_id,
        }
      : null,
    submission_data: job.submission_data,
  };

  return await getFeedbackEmailRecipient(supabase, jobContext, emailConfig, fieldConfigMap);
}

/**
 * Returns whether private feedback exists.
 * On DB error: fail-closed (`true`) so we never send a duplicate request.
 */
async function hasPrivateFeedback(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ exists: boolean; lookupFailed: boolean }> {
  const { data, error } = await supabase
    .from("feedback")
    .select("id")
    .eq("job_id", jobId)
    .limit(1)
    .maybeSingle();
  if (error) {
    return { exists: true, lookupFailed: true };
  }
  return { exists: !!data, lookupFailed: false };
}

async function cancelOutbox(
  supabase: SupabaseClient,
  outboxId: string,
  lastError: string
): Promise<void> {
  await supabase
    .from("feedback_email_outbox")
    .update({
      status: "cancelled",
      last_error: lastError,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    })
    .eq("id", outboxId);
}

async function markOutboxFailed(
  supabase: SupabaseClient,
  outboxId: string,
  attempts: number,
  lastError: string
): Promise<void> {
  const nextAttempts = attempts + 1;
  const terminal = nextAttempts >= MAX_ATTEMPTS;
  const nextRetry = terminal
    ? null
    : new Date(Date.now() + backoffMinutes(nextAttempts) * 60 * 1000).toISOString();

  await supabase
    .from("feedback_email_outbox")
    .update({
      // Both retryable and terminal use `failed`; poller re-picks via next_retry_at.
      status: "failed",
      attempts: nextAttempts,
      last_error: lastError,
      next_retry_at: nextRetry,
      updated_at: new Date().toISOString(),
      processed_at: terminal ? new Date().toISOString() : null,
    })
    .eq("id", outboxId);
}

async function markOutboxSucceeded(
  supabase: SupabaseClient,
  outboxId: string,
  emailId: string | undefined,
  mode: FeedbackRequestMode,
  publicUrl: string | null
): Promise<void> {
  await supabase
    .from("feedback_email_outbox")
    .update({
      status: "succeeded",
      email_id: emailId ?? null,
      mode_at_send: mode,
      public_review_url_at_send: publicUrl,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      next_retry_at: null,
      last_error: null,
    })
    .eq("id", outboxId);
}

/**
 * Final mid-flight gate immediately before Resend.
 * Returns null if OK to send, or cancel reason.
 */
export function evaluateCancelGate(params: {
  org: OrgFeedbackConfig;
  locationMuted: boolean;
  approvalStatus: string | null;
  mode: FeedbackRequestMode;
}): string | null {
  if (!params.org.feedback_requests_enabled) {
    return "feedback_requests_disabled";
  }
  if (params.locationMuted) {
    return "location_muted";
  }
  if (params.approvalStatus === "flagged" || params.approvalStatus === "cancelled") {
    return `job_${params.approvalStatus}`;
  }
  if (params.mode !== "internal" && !isHttpsUrl(params.org.public_review_url)) {
    return "missing_public_review_url";
  }
  return null;
}

async function claimOutboxRow(supabase: SupabaseClient, outboxId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("feedback_email_outbox")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", outboxId)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

async function performSend(
  supabase: SupabaseClient,
  job: JobRow,
  org: OrgFeedbackConfig,
  locationData: ReturnType<typeof unwrapLocation>,
  recipientEmail: string,
  outboxId: string,
  mode: FeedbackRequestMode
): Promise<EnqueueOrSendResult> {
  const logger = createLoggerWithoutRequest({ functionName: "feedback-send" });

  const cancelReason = evaluateCancelGate({
    org,
    locationMuted: !!(job.location_id && locationData && !locationData.feedback_requests_enabled),
    approvalStatus: job.approval_status,
    mode,
  });
  if (cancelReason) {
    await cancelOutbox(supabase, outboxId, cancelReason);
    return {
      ok: true,
      cancelled: true,
      reason: cancelReason,
      outboxId,
      status: "cancelled",
    };
  }

  let feedbackToken = job.feedback_token;
  if (mode !== "public") {
    if (!feedbackToken) {
      feedbackToken = generateFeedbackToken();
      const { error: tokenError } = await supabase
        .from("job")
        .update({ feedback_token: feedbackToken })
        .eq("id", job.id);
      if (tokenError) {
        logger.warn("Failed to persist feedback token", {
          jobId: job.id,
          error: tokenError,
        });
        const { data: outboxRow } = await supabase
          .from("feedback_email_outbox")
          .select("attempts")
          .eq("id", outboxId)
          .maybeSingle();
        await markOutboxFailed(
          supabase,
          outboxId,
          outboxRow?.attempts ?? 0,
          "failed_to_persist_token"
        );
        return {
          ok: false,
          reason: "failed_to_persist_token",
          error_code: "token_persist_failed",
          outboxId,
        };
      }
    }
  }

  const publicUrl = mode === "internal" ? null : org.public_review_url?.trim() || null;

  const emailData: FeedbackEmailData = {
    recipientEmail,
    recipientName: locationData?.contact_person || null,
    organizationName: org.name || "Our Team",
    organizationId: job.organization_id,
    jobId: job.id,
    jobCompletedAt: job.completed_at || job.created_at || new Date().toISOString(),
    locationName: locationData?.name || null,
    feedbackToken: feedbackToken,
    feedbackReviewUrl: "",
    mode,
    publicReviewUrl: publicUrl,
    subjectTemplate: org.feedback_email_subject,
    bodyTemplate: org.feedback_email_body,
    replyTo: org.feedback_email_reply_to,
    locale: org.locale,
  };

  const emailResult = await sendFeedbackRequestEmail(supabase, emailData, false);
  if (!emailResult.success) {
    const { data: row } = await supabase
      .from("feedback_email_outbox")
      .select("attempts")
      .eq("id", outboxId)
      .maybeSingle();
    await markOutboxFailed(
      supabase,
      outboxId,
      row?.attempts ?? 0,
      emailResult.error || "send_failed"
    );
    return {
      ok: false,
      reason: emailResult.error || "send_failed",
      error_code: "send_failed",
      outboxId,
    };
  }

  await markOutboxSucceeded(supabase, outboxId, emailResult.emailId, mode, publicUrl);

  const jobUpdate: Record<string, unknown> = {
    feedback_email_sent: true,
    feedback_email_sent_at: new Date().toISOString(),
    feedback_mode_at_send: mode,
    public_review_url_at_send: publicUrl,
  };
  if (feedbackToken) {
    jobUpdate.feedback_token = feedbackToken;
  }

  const { error: jobUpdateError } = await supabase.from("job").update(jobUpdate).eq("id", job.id);

  if (jobUpdateError) {
    logger.warn("Email sent but job tracking update failed", {
      jobId: job.id,
      error: jobUpdateError,
    });
  }

  return {
    ok: true,
    sent: true,
    emailId: emailResult.emailId,
    outboxId,
    status: "succeeded",
  };
}

/**
 * Enqueue (and optionally claim+send) a feedback request for a job.
 * Never throws — callers log and continue (PRESERVE-1).
 */
export async function enqueueOrSendFeedback(
  supabase: SupabaseClient,
  jobId: string,
  options: EnqueueOrSendOptions
): Promise<EnqueueOrSendResult> {
  const logger = createLoggerWithoutRequest({
    functionName: "enqueueOrSendFeedback",
  });
  const now = options.now ?? new Date();

  try {
    const job = await loadJob(supabase, jobId);
    if (!job) {
      return { ok: false, reason: "job_not_found", error_code: "job_not_found" };
    }

    const org = await loadOrg(supabase, job.organization_id);
    if (!org) {
      return { ok: false, reason: "org_not_found", error_code: "org_not_found" };
    }

    const mode = (org.feedback_request_mode || "internal") as FeedbackRequestMode;
    const locationData = unwrapLocation(job.location);
    const locationMuted = !!(
      job.location_id &&
      locationData &&
      !locationData.feedback_requests_enabled
    );

    if (!org.feedback_requests_enabled) {
      // Auto: soft-skip (create-job continues). Manual: hard error for API clients.
      if (options.path === "manual") {
        return {
          ok: false,
          reason: "feedback_requests_disabled",
          error_code: "feedback_requests_disabled",
        };
      }
      return {
        ok: true,
        skipped: true,
        reason: "feedback_requests_disabled",
      };
    }

    if (locationMuted) {
      if (options.path === "manual") {
        return {
          ok: false,
          reason: "location_muted",
          error_code: "location_muted",
        };
      }
      return { ok: true, skipped: true, reason: "location_muted" };
    }

    if (options.path === "auto") {
      if (!org.feedback_auto_send) {
        return { ok: true, skipped: true, reason: "auto_send_disabled" };
      }
      if (job.is_test) {
        return { ok: true, skipped: true, reason: "test_job" };
      }
      if (job.approval_status === "flagged" || job.approval_status === "cancelled") {
        return {
          ok: true,
          skipped: true,
          reason: `job_${job.approval_status}`,
        };
      }
      if (job.feedback_email_sent) {
        return { ok: true, skipped: true, reason: "already_sent" };
      }
    }

    if (options.path === "manual") {
      if (
        job.edit_window_expires_at &&
        new Date(job.edit_window_expires_at).getTime() > now.getTime()
      ) {
        return {
          ok: false,
          reason: "edit_window_open",
          error_code: "edit_window_open",
        };
      }
      if (job.approval_status === "cancelled") {
        return {
          ok: false,
          reason: "job_cancelled",
          error_code: "job_cancelled",
        };
      }
      if (job.approval_status === "flagged" && !options.confirmFlagged) {
        return {
          ok: false,
          reason: "confirm_flagged_required",
          error_code: "confirm_flagged_required",
        };
      }
      if (job.is_test && !options.confirmTest) {
        return {
          ok: false,
          reason: "confirm_test_required",
          error_code: "confirm_test_required",
        };
      }
      if (job.feedback_email_sent && !options.confirmResend) {
        return {
          ok: false,
          reason: "confirm_resend_required",
          error_code: "confirm_resend_required",
        };
      }
    }

    if (mode !== "internal" && !isHttpsUrl(org.public_review_url)) {
      return {
        ok: options.path === "auto",
        skipped: options.path === "auto",
        reason: "missing_public_review_url",
        error_code: "missing_public_review_url",
      };
    }

    const feedbackLookup = await hasPrivateFeedback(supabase, job.id);
    if (feedbackLookup.lookupFailed) {
      return {
        ok: false,
        reason: "feedback_lookup_failed",
        error_code: "feedback_lookup_failed",
      };
    }
    if (feedbackLookup.exists) {
      return {
        ok: options.path === "auto",
        skipped: options.path === "auto",
        reason: "feedback_already_submitted",
        error_code: "feedback_already_submitted",
      };
    }

    const recipientEmail = await resolveRecipient(supabase, job, locationData);
    if (!recipientEmail) {
      // L9: never mint token without a recipient
      return {
        ok: options.path === "auto",
        skipped: options.path === "auto",
        reason: "no_recipient",
        error_code: "no_recipient",
      };
    }

    // Auto: honour delay + edit window. Manual: edit window already gated; send ASAP.
    const sendAfter =
      options.path === "manual"
        ? now
        : computeSendAfter({
            completedAt: job.completed_at,
            createdAt: job.created_at,
            editWindowExpiresAt: job.edit_window_expires_at,
            delayHours: org.feedback_send_delay_hours ?? 0,
          });

    const isResend = !!(options.isResend || options.confirmResend || job.feedback_email_sent);

    // Upsert pending row (unique on pending job_id). Refresh send_after if exists.
    const { data: existingPending } = await supabase
      .from("feedback_email_outbox")
      .select("id, status, send_after")
      .eq("job_id", job.id)
      .eq("status", "pending")
      .maybeSingle();

    let outboxId = existingPending?.id as string | undefined;

    if (outboxId) {
      await supabase
        .from("feedback_email_outbox")
        .update({
          send_after: sendAfter.toISOString(),
          mode_at_send: mode,
          public_review_url_at_send: mode === "internal" ? null : org.public_review_url,
          is_resend: isResend,
          updated_at: now.toISOString(),
        })
        .eq("id", outboxId);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("feedback_email_outbox")
        .insert({
          job_id: job.id,
          organization_id: job.organization_id,
          send_after: sendAfter.toISOString(),
          status: "pending",
          mode_at_send: mode,
          public_review_url_at_send: mode === "internal" ? null : org.public_review_url,
          is_resend: isResend,
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        // Race: another worker inserted pending — re-read
        const { data: raced } = await supabase
          .from("feedback_email_outbox")
          .select("id")
          .eq("job_id", job.id)
          .eq("status", "pending")
          .maybeSingle();
        outboxId = raced?.id;
        if (!outboxId) {
          logger.warn("Failed to enqueue feedback outbox", {
            jobId: job.id,
            error: insertError,
          });
          return {
            ok: false,
            reason: "enqueue_failed",
            error_code: "enqueue_failed",
          };
        }
      } else {
        outboxId = inserted?.id;
      }
    }

    if (!outboxId) {
      return {
        ok: false,
        reason: "enqueue_failed",
        error_code: "enqueue_failed",
      };
    }

    // Manual path ignores delay for "send now" once edit window has passed —
    // still honour edit window via gates above; if send_after is in future due to
    // delay hours, queue unless delay already elapsed.
    if (sendAfter.getTime() > now.getTime()) {
      return {
        ok: true,
        queued: true,
        outboxId,
        status: "pending",
        reason: "deferred",
      };
    }

    const claimed = await claimOutboxRow(supabase, outboxId);
    if (!claimed) {
      return {
        ok: true,
        queued: true,
        outboxId,
        status: "pending",
        reason: "claim_race",
      };
    }

    // Reload job for fresh token/flags before send
    const freshJob = await loadJob(supabase, jobId);
    if (!freshJob) {
      await cancelOutbox(supabase, outboxId, "job_missing");
      return {
        ok: true,
        cancelled: true,
        reason: "job_missing",
        outboxId,
      };
    }

    return await performSend(
      supabase,
      freshJob,
      org,
      unwrapLocation(freshJob.location),
      recipientEmail,
      outboxId,
      mode
    );
  } catch (error) {
    logger.error("enqueueOrSendFeedback unexpected error", error, { jobId });
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unexpected_error",
      error_code: "unexpected_error",
    };
  }
}

const STUCK_PROCESSING_MS = 15 * 60 * 1000;

/**
 * Re-queue rows stuck in `processing` (crash mid-send) so the poller can retry.
 */
async function recoverStuckProcessingRows(supabase: SupabaseClient, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_PROCESSING_MS).toISOString();
  const { data, error } = await supabase
    .from("feedback_email_outbox")
    .update({
      status: "failed",
      next_retry_at: now.toISOString(),
      last_error: "stuck_processing_recovered",
      updated_at: now.toISOString(),
    })
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    createLoggerWithoutRequest({ functionName: "recoverStuckProcessingRows" }).warn(
      "Failed to recover stuck processing rows",
      { error }
    );
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Process due outbox rows (poller). Returns counts.
 */
export async function processDueFeedbackOutbox(
  supabase: SupabaseClient,
  options?: { limit?: number; now?: Date }
): Promise<{
  claimed: number;
  sent: number;
  cancelled: number;
  failed: number;
  recovered: number;
}> {
  const logger = createLoggerWithoutRequest({
    functionName: "processDueFeedbackOutbox",
  });
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 25;
  const nowIso = now.toISOString();

  const recovered = await recoverStuckProcessingRows(supabase, now);

  // Quote ISO timestamps for PostgREST `.or()` filter safety.
  const { data: dueRows, error } = await supabase
    .from("feedback_email_outbox")
    .select("id, job_id, attempts, status, send_after, next_retry_at")
    .in("status", ["pending", "failed"])
    .lte("send_after", nowIso)
    .or(`next_retry_at.is.null,next_retry_at.lte."${nowIso}"`)
    .order("send_after", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("Failed to list due feedback outbox rows", error);
    return { claimed: 0, sent: 0, cancelled: 0, failed: 0, recovered };
  }

  let claimed = 0;
  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const row of dueRows || []) {
    const didClaim = await claimOutboxRow(supabase, row.id);
    if (!didClaim) continue;
    claimed += 1;

    const result = await sendClaimedFeedbackOutbox(supabase, row.id, row.job_id);

    if (result.cancelled) {
      cancelled += 1;
      continue;
    }
    if (result.sent) {
      sent += 1;
      continue;
    }
    if (!result.ok) {
      failed += 1;
    }
  }

  return { claimed, sent, cancelled, failed, recovered };
}

/**
 * Recompute send_after for a job's pending outbox row (after completed_at / location change).
 */
export async function recomputePendingFeedbackSendAfter(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const job = await loadJob(supabase, jobId);
  if (!job) return;
  const org = await loadOrg(supabase, job.organization_id);
  if (!org) return;

  const locationData = unwrapLocation(job.location);
  const locationMuted = !!(
    job.location_id &&
    locationData &&
    !locationData.feedback_requests_enabled
  );

  const { data: pending } = await supabase
    .from("feedback_email_outbox")
    .select("id")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .maybeSingle();

  if (!pending?.id) return;

  if (
    !org.feedback_requests_enabled ||
    locationMuted ||
    job.approval_status === "flagged" ||
    job.approval_status === "cancelled"
  ) {
    await cancelOutbox(
      supabase,
      pending.id,
      !org.feedback_requests_enabled
        ? "feedback_requests_disabled"
        : locationMuted
          ? "location_muted"
          : `job_${job.approval_status}`
    );
    return;
  }

  const sendAfter = computeSendAfter({
    completedAt: job.completed_at,
    createdAt: job.created_at,
    editWindowExpiresAt: job.edit_window_expires_at,
    delayHours: org.feedback_send_delay_hours ?? 0,
  });

  const { error: updateError } = await supabase
    .from("feedback_email_outbox")
    .update({
      send_after: sendAfter.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  if (updateError) {
    throw new Error(
      `Failed to recompute feedback outbox send_after for job ${jobId}: ${updateError.message}`
    );
  }
}

/**
 * Send a claimed outbox row (poller path that already owns the claim).
 */
export async function sendClaimedFeedbackOutbox(
  supabase: SupabaseClient,
  outboxId: string,
  jobId: string
): Promise<EnqueueOrSendResult> {
  const job = await loadJob(supabase, jobId);
  if (!job) {
    await cancelOutbox(supabase, outboxId, "job_missing");
    return { ok: true, cancelled: true, reason: "job_missing", outboxId };
  }
  const org = await loadOrg(supabase, job.organization_id);
  if (!org) {
    await cancelOutbox(supabase, outboxId, "org_missing");
    return { ok: true, cancelled: true, reason: "org_missing", outboxId };
  }

  const mode = (org.feedback_request_mode || "internal") as FeedbackRequestMode;
  const locationData = unwrapLocation(job.location);

  const cancelReason = evaluateCancelGate({
    org,
    locationMuted: !!(job.location_id && locationData && !locationData.feedback_requests_enabled),
    approvalStatus: job.approval_status,
    mode,
  });
  if (cancelReason) {
    await cancelOutbox(supabase, outboxId, cancelReason);
    return {
      ok: true,
      cancelled: true,
      reason: cancelReason,
      outboxId,
      status: "cancelled",
    };
  }

  if (job.is_test) {
    await cancelOutbox(supabase, outboxId, "test_job");
    return { ok: true, cancelled: true, reason: "test_job", outboxId };
  }

  const feedbackLookup = await hasPrivateFeedback(supabase, job.id);
  if (feedbackLookup.lookupFailed) {
    const { data: outboxRow } = await supabase
      .from("feedback_email_outbox")
      .select("attempts")
      .eq("id", outboxId)
      .maybeSingle();
    await markOutboxFailed(supabase, outboxId, outboxRow?.attempts ?? 0, "feedback_lookup_failed");
    return {
      ok: false,
      reason: "feedback_lookup_failed",
      error_code: "feedback_lookup_failed",
      outboxId,
    };
  }
  if (feedbackLookup.exists) {
    await cancelOutbox(supabase, outboxId, "feedback_already_submitted");
    return {
      ok: true,
      cancelled: true,
      reason: "feedback_already_submitted",
      outboxId,
    };
  }

  const recipientEmail = await resolveRecipient(supabase, job, locationData);
  if (!recipientEmail) {
    await cancelOutbox(supabase, outboxId, "no_recipient");
    return { ok: true, cancelled: true, reason: "no_recipient", outboxId };
  }

  return await performSend(supabase, job, org, locationData, recipientEmail, outboxId, mode);
}
