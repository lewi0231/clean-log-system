import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { listJobsSchema, validateRequest } from "../_utils/zod-schemas.ts";
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
  worker:
    | Worker
    | Worker[]
    | null;
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

    const { organization_id, include_tests } = validation.data as {
      organization_id: string;
      include_tests?: boolean;
    };

    const supabase = createServiceRoleClient();

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
          phone
        ),
        invoice_job:invoice_job (
          invoice:invoice_id (
            id,
            invoice_number,
            status,
            paid_at
          )
        )
      `,
      )
      .eq("organization_id", organization_id);

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
        `,
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

    const jobsWithFeedback = new Set(
      feedbackData?.map((f) => f.job_id) || [],
    );

    // Combine jobs with their workers and feedback status
    const jobsWithWorkers = jobs?.map((job) => ({
      ...job,
      workers: workersByJobId.get(job.id) || [],
      has_feedback: jobsWithFeedback.has(job.id),
    }));

    return jsonResponse({
      success: true,
      jobs: jobsWithWorkers || [],
    });
  } catch (error) {
    logger.error("List jobs error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list jobs",
    );
  }
});
