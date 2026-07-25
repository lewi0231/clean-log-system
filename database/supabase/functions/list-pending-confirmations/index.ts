import { serve } from "server";
import { extractAuthToken, getAuthUser, resolveWorkerIdForAuthUser } from "../_utils/auth.ts";
import {
  autoApproveExpiredJobs,
  filterActivePendingConfirmations,
} from "../_utils/auto-approve-expired-jobs.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

/**
 * list-pending-confirmations
 *
 * Returns a list of jobs that require the authenticated worker's confirmation.
 * Used by the mobile app to show pending confirmations.
 */
serve(async (req) => {
  const logger = createLogger(req, { functionName: "list-pending-confirmations" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);
    if (!token) {
      logger.warn("No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabase = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);
    if (!authUser) {
      logger.warn("User not found after token verification");
      return errorResponse("User not found", 401);
    }

    // Resolve worker from JWT (metadata first, then auth_user_id fallback)
    const workerId = await resolveWorkerIdForAuthUser(
      supabase,
      authUser.id,
      authUser.user_metadata
    );
    if (!workerId) {
      logger.warn("User is not a worker", { userId: authUser.id });
      return errorResponse("Only workers can view pending confirmations", 403);
    }

    logger.debug("Fetching pending confirmations", { workerId });

    // Opportunistic auto-approve: cron may be idle (local) or delayed.
    // Approve expired colleague-pending jobs before listing so they disappear.
    try {
      const approved = await autoApproveExpiredJobs(supabase, {
        sideEffects: true,
      });
      if (approved.jobsApproved > 0) {
        logger.info("Auto-approved expired jobs before listing pending confirmations", {
          jobsApproved: approved.jobsApproved,
        });
      }
    } catch (autoApproveError) {
      logger.warn("Opportunistic auto-approve failed; continuing with list", {
        error: autoApproveError instanceof Error ? autoApproveError.message : "Unknown error",
      });
    }

    // Find all job_worker entries where this worker has pending confirmation status
    // and the job is still in pending status
    const { data: pendingJobs, error: fetchError } = await supabase
      .from("job_worker")
      .select(
        `
        job_id,
        confirmation_status,
        job:job_id (
          id,
          organization_id,
          completed_at,
          created_at,
          approval_status,
          auto_approve_at,
          edit_window_expires_at,
          submitted_by_worker_id,
          submission_data,
          location:location_id (
            id,
            name,
            address
          ),
          submitter:submitted_by_worker_id (
            id,
            name,
            email
          )
        )
      `
      )
      .eq("worker_id", workerId)
      .eq("confirmation_status", "pending");

    if (fetchError) {
      logger.error("Error fetching pending confirmations", fetchError);
      throw fetchError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      logger.debug("No pending confirmations found", { workerId });
      return jsonResponse({
        success: true,
        pending_confirmations: [],
        count: 0,
      });
    }

    // Filter to only include jobs that are still in pending status
    // (job could have been flagged or cancelled after query)
    const activeJobs = pendingJobs.filter((pj) => {
      const job = Array.isArray(pj.job) ? pj.job[0] : pj.job;
      return job && job.approval_status === "pending";
    });

    // Get all workers on each job for display
    const jobIds = activeJobs
      .map((pj) => {
        const job = Array.isArray(pj.job) ? pj.job[0] : pj.job;
        return job?.id;
      })
      .filter(Boolean) as string[];

    const { data: allJobWorkers } = await supabase
      .from("job_worker")
      .select(
        `
        job_id,
        worker:worker_id (
          id,
          name
        ),
        confirmation_status
      `
      )
      .in("job_id", jobIds);

    // Group workers by job_id
    const workersByJobId = new Map<
      string,
      Array<{ id: string; name: string; confirmation_status: string }>
    >();
    (allJobWorkers || []).forEach((jw) => {
      const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
      if (!worker) return;

      if (!workersByJobId.has(jw.job_id)) {
        workersByJobId.set(jw.job_id, []);
      }
      workersByJobId.get(jw.job_id)?.push({
        id: worker.id,
        name: worker.name,
        confirmation_status: jw.confirmation_status,
      });
    });

    // Format response — exclude past-deadline rows even if auto-approve raced
    const pendingConfirmations = filterActivePendingConfirmations(
      activeJobs
        .map((pj) => {
          const job = Array.isArray(pj.job) ? pj.job[0] : pj.job;
          if (!job) return null;

          const location = Array.isArray(job.location) ? job.location[0] : job.location;
          const submitter = Array.isArray(job.submitter) ? job.submitter[0] : job.submitter;

          return {
            job_id: job.id,
            location_name: location?.name || null,
            location_address: location?.address || null,
            completed_at: job.completed_at,
            created_at: job.created_at,
            auto_approve_at: job.auto_approve_at as string | null,
            submitted_by: submitter?.name || "Unknown",
            submitted_by_worker_id: job.submitted_by_worker_id,
            workers: workersByJobId.get(job.id) || [],
            submission_data: job.submission_data ?? {},
          };
        })
        .filter(Boolean) as Array<{
        job_id: string;
        auto_approve_at: string | null;
        [key: string]: unknown;
      }>
    );

    logger.debug("Found pending confirmations", {
      workerId,
      count: pendingConfirmations.length,
    });

    return jsonResponse({
      success: true,
      pending_confirmations: pendingConfirmations,
      count: pendingConfirmations.length,
    });
  } catch (error) {
    logger.error("List pending confirmations error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to list pending confirmations"
    );
  }
});
