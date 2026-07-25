import { serve } from "server";
import { extractAuthToken, getAuthUser, resolveOrganizationWorkerId } from "../_utils/auth.ts";
import { autoApproveExpiredJobs } from "../_utils/auto-approve-expired-jobs.ts";
import { normalizeFeedbackRequestMode } from "../_utils/feedback-review-landing.ts";
import {
  computeFeedbackRequestStatus,
  hasFeedbackRecipientHint,
  type FeedbackOutboxStatus,
} from "../_utils/feedback-request-status.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { listJobsSchema, validateRequest } from "../_utils/zod-schemas.ts";
import { mergeParticipatingJobIds, resolveListJobsWorkerScope } from "./scoping.ts";
import type { Worker } from "../types.ts";

// Extended types for confirmation workflow
interface JobWorkerWithConfirmation {
  job_id: string;
  worker_id: string;
  confirmation_status: "confirmed" | "pending" | "flagged";
  confirmed_at: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
  worker: Worker | null;
}

interface JobWorkerQueryResultWithConfirmation {
  job_id: string;
  worker_id: string;
  confirmation_status: "confirmed" | "pending" | "flagged";
  confirmed_at: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
  worker: Worker | Worker[] | null;
}

interface WorkerWithConfirmation extends Worker {
  confirmation_status: "confirmed" | "pending" | "flagged";
  confirmed_at: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
}

serve(async (req) => {
  const logger = createLogger(req, { functionName: "list-jobs" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const rawBody = await req.json();
    const validation = validateRequest(listJobsSchema, rawBody);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    const { organization_id, include_tests, worker_id, mine } = validation.data as {
      organization_id: string;
      include_tests?: boolean;
      worker_id?: string;
      mine?: boolean;
    };

    const supabase = createServiceRoleClient();

    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) {
      if (orgGate.response.status === 403) {
        logger.warn("Unauthorized organization access attempt", {
          organization_id,
        });
      }
      return orgGate.response;
    }

    // Opportunistic auto-approve so completed-jobs UI does not show stale
    // "pending confirmation" after the colleague timeout when cron is idle.
    try {
      await autoApproveExpiredJobs(supabase, { sideEffects: true });
    } catch (autoApproveError) {
      logger.warn("Opportunistic auto-approve failed; continuing with list-jobs", {
        error: autoApproveError instanceof Error ? autoApproveError.message : "Unknown error",
      });
    }

    let scopedJobIds: string[] | null = null;

    const token = extractAuthToken(req);
    const authUser = token ? await getAuthUser(token) : null;
    const callerWorkerId = authUser?.id
      ? await resolveOrganizationWorkerId(
          supabase,
          organization_id,
          authUser.id,
          authUser.user_metadata
        )
      : null;

    const scope = resolveListJobsWorkerScope({
      mine,
      workerId: worker_id ?? null,
      callerWorkerId,
    });

    if (!scope.ok) {
      return errorResponse(scope.message, scope.status);
    }

    const effectiveWorkerId = scope.effectiveWorkerId;

    if (mine && !effectiveWorkerId) {
      return jsonResponse({
        success: true,
        jobs: [],
      });
    }

    if (effectiveWorkerId) {
      const { data: workerRow, error: workerError } = await supabase
        .from("worker")
        .select("id")
        .eq("id", effectiveWorkerId)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (workerError) throw workerError;
      if (!workerRow) {
        return errorResponse("Worker not found in this organization", 404);
      }

      const { data: workerJobRows, error: workerJobsError } = await supabase
        .from("job_worker")
        .select("job_id")
        .eq("worker_id", effectiveWorkerId);

      if (workerJobsError) throw workerJobsError;

      const { data: submittedJobs, error: submittedJobsError } = await supabase
        .from("job")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("submitted_by_worker_id", effectiveWorkerId);

      if (submittedJobsError) throw submittedJobsError;

      scopedJobIds = mergeParticipatingJobIds(
        workerJobRows?.map((row) => row.job_id) ?? [],
        submittedJobs?.map((job) => job.id) ?? []
      );

      if (scopedJobIds.length === 0) {
        return jsonResponse({
          success: true,
          jobs: [],
        });
      }
    }

    // Fetch jobs with location info, invoice data, and approval status
    let query = supabase
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        is_test,
        submission_data,
        completed_at,
        created_at,
        feedback_token,
        feedback_email_sent,
        feedback_email_sent_at,
        submitted_by_email,
        last_updated_at,
        last_updated_by,
        approval_status,
        auto_approve_at,
        edit_window_expires_at,
        submitted_by_worker_id,
        location:location_id (
          id,
          name,
          email,
          address,
          contact_person,
          phone,
          feedback_requests_enabled
        ),
        invoice_job:invoice_job (
          invoice:invoice_id (
            id,
            invoice_number,
            status,
            paid_at
          )
        )
      `
      )
      .eq("organization_id", organization_id);

    if (scopedJobIds) {
      query = query.in("id", scopedJobIds);
    }

    // Exclude test jobs by default
    if (!include_tests) {
      query = query.eq("is_test", false);
    }

    const { data: jobs, error: jobsError } = await query.order("completed_at", {
      ascending: false,
    });

    if (jobsError) throw jobsError;

    // Fetch all job_worker relationships for these jobs with confirmation status
    const jobIds = jobs?.map((job) => job.id) || [];
    let jobWorkers: JobWorkerWithConfirmation[] = [];

    if (jobIds.length > 0) {
      const { data, error: jobWorkersError } = await supabase
        .from("job_worker")
        .select(
          `
          job_id,
          worker_id,
          confirmation_status,
          confirmed_at,
          flagged_at,
          flag_reason,
          worker:worker_id (
            id,
            name,
            email,
            phone
          )
        `
        )
        .in("job_id", jobIds);

      if (jobWorkersError) throw jobWorkersError;

      // Type assertion: Supabase may infer worker as array, but it's actually a single object
      // Each job_worker row has exactly one worker_id, so worker should be a single object
      jobWorkers = ((data || []) as JobWorkerQueryResultWithConfirmation[]).map((item) => ({
        job_id: item.job_id,
        worker_id: item.worker_id,
        confirmation_status: item.confirmation_status,
        confirmed_at: item.confirmed_at,
        flagged_at: item.flagged_at,
        flag_reason: item.flag_reason,
        worker: Array.isArray(item.worker)
          ? (item.worker[0] as Worker | null)
          : (item.worker as Worker | null),
      }));
    }

    // Group workers by job_id, including confirmation status
    const workersByJobId = new Map<string, WorkerWithConfirmation[]>();
    jobWorkers.forEach((jw) => {
      if (!workersByJobId.has(jw.job_id)) {
        workersByJobId.set(jw.job_id, []);
      }
      if (jw.worker) {
        workersByJobId.get(jw.job_id)?.push({
          ...jw.worker,
          confirmation_status: jw.confirmation_status,
          confirmed_at: jw.confirmed_at,
          flagged_at: jw.flagged_at,
          flag_reason: jw.flag_reason,
        });
      }
    });

    // Fetch feedback for all jobs to check if feedback has been received
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select("job_id")
      .in("job_id", jobIds);

    if (feedbackError) {
      logger.warn("Error fetching feedback", { error: feedbackError.message });
      // Don't fail the entire request if feedback fetch fails
    }

    const jobsWithFeedback = new Set(feedbackData?.map((f) => f.job_id) || []);

    // Org feedback settings (one row) for status chips
    const { data: orgRow, error: orgError } = await supabase
      .from("organization")
      .select("feedback_requests_enabled, feedback_request_mode, public_review_url")
      .eq("id", organization_id)
      .maybeSingle();

    if (orgError) {
      // Fail closed: do not advertise Ready/Send when settings cannot be loaded.
      logger.warn("Error fetching organization feedback settings; status chips fail closed", {
        error: orgError.message,
      });
    }

    // Invoice recipient defaults for lightweight no_recipient hint
    const { data: templateConfig, error: templateError } = await supabase
      .from("invoice_template_config")
      .select("email_recipient_config")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (templateError) {
      logger.warn("Error fetching invoice recipient config for feedback status", {
        error: templateError.message,
      });
    }

    const emailRecipientConfig =
      (templateConfig?.email_recipient_config as {
        default_email?: string | null;
        form_field_email?: string | null;
      } | null) || null;

    let formFieldName: string | null = null;
    if (emailRecipientConfig?.form_field_email) {
      const { data: fieldRow, error: fieldError } = await supabase
        .from("organization_field_configs")
        .select("name")
        .eq("id", emailRecipientConfig.form_field_email)
        .eq("organization_id", organization_id)
        .maybeSingle();
      if (fieldError) {
        logger.warn("Error resolving form-field email name for feedback status", {
          error: fieldError.message,
        });
      }
      formFieldName = fieldRow?.name ?? null;
    }

    // Latest outbox row per job (for queued/failed/sent chips)
    const outboxByJobId = new Map<
      string,
      { status: FeedbackOutboxStatus; send_after: string | null; last_error: string | null }
    >();
    if (jobIds.length > 0) {
      const { data: outboxRows, error: outboxError } = await supabase
        .from("feedback_email_outbox")
        .select("job_id, status, send_after, last_error, updated_at")
        .in("job_id", jobIds)
        .order("updated_at", { ascending: false });

      if (outboxError) {
        logger.warn("Error fetching feedback outbox for status chips", {
          error: outboxError.message,
        });
      } else {
        for (const row of outboxRows || []) {
          if (outboxByJobId.has(row.job_id)) continue;
          outboxByJobId.set(row.job_id, {
            status: (row.status as FeedbackOutboxStatus) ?? null,
            send_after: row.send_after ?? null,
            last_error: row.last_error ?? null,
          });
        }
      }
    }

    // Fail closed when org settings are unavailable (error or missing row).
    const orgFeedbackEnabled =
      !orgError && orgRow != null && orgRow.feedback_requests_enabled !== false;
    const mode = normalizeFeedbackRequestMode(orgRow?.feedback_request_mode);
    const hasPublicReviewUrl = !!(
      typeof orgRow?.public_review_url === "string" &&
      /^https:\/\//i.test(orgRow.public_review_url.trim())
    );
    const defaultEmail =
      typeof emailRecipientConfig?.default_email === "string"
        ? emailRecipientConfig.default_email.trim()
        : "";

    // Combine jobs with their workers and feedback status
    const jobsWithWorkers = jobs?.map((job) => {
      const location = Array.isArray(job.location) ? job.location[0] : job.location;
      const locationMuted =
        !!job.location_id &&
        location != null &&
        (location as { feedback_requests_enabled?: boolean }).feedback_requests_enabled === false;

      const locationEmail = typeof location?.email === "string" ? location.email.trim() : "";
      const submission = (job.submission_data || {}) as Record<string, unknown>;
      const formEmail =
        formFieldName && typeof submission[formFieldName] === "string"
          ? String(submission[formFieldName]).trim()
          : "";
      const hasRecipientHint = hasFeedbackRecipientHint({
        locationEmail,
        defaultEmail,
        formEmail,
      });

      const outbox = outboxByJobId.get(job.id);
      const hasFeedback = jobsWithFeedback.has(job.id);

      const feedback_request_status = computeFeedbackRequestStatus({
        orgFeedbackEnabled,
        locationMuted,
        approvalStatus: job.approval_status,
        hasPrivateFeedback: hasFeedback,
        feedbackEmailSent: !!job.feedback_email_sent,
        editWindowExpiresAt: job.edit_window_expires_at,
        hasRecipientHint,
        mode,
        hasPublicReviewUrl,
        isTest: !!job.is_test,
        outboxStatus: outbox?.status ?? null,
        sendAfter: outbox?.send_after ?? null,
        lastError: outbox?.last_error ?? null,
      });

      return {
        ...job,
        workers: workersByJobId.get(job.id) || [],
        has_feedback: hasFeedback,
        feedback_request_status,
      };
    });

    return jsonResponse({
      success: true,
      jobs: jobsWithWorkers || [],
    });
  } catch (error) {
    logger.error("List jobs error", error);
    return errorResponse(error instanceof Error ? error : "Failed to list jobs");
  }
});
