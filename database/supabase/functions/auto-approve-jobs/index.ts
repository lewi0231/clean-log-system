import { serve } from "server";
import { autoApproveExpiredJobs } from "../_utils/auto-approve-expired-jobs.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLoggerWithoutRequest } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

/**
 * auto-approve-jobs
 *
 * Scheduled function that runs periodically to auto-approve jobs
 * that have passed their auto_approve_at timestamp without action.
 *
 * Prefer scheduling every 5 minutes (Dashboard Schedules or pg_cron).
 * List endpoints also call autoApproveExpiredJobs opportunistically when
 * cron is not running (e.g. local dev).
 */
serve(async (req) => {
  const logger = createLoggerWithoutRequest({ functionName: "auto-approve-jobs" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await autoApproveExpiredJobs(supabase, { sideEffects: true });

    if (result.jobsApproved === 0) {
      logger.debug("No jobs to auto-approve");
      return jsonResponse({
        success: true,
        message: "No jobs to auto-approve",
        jobs_approved: 0,
      });
    }

    return jsonResponse({
      success: true,
      message: `Auto-approved ${result.jobsApproved} job(s)`,
      jobs_approved: result.jobsApproved,
      job_ids: result.jobIds,
    });
  } catch (error) {
    logger.error("Auto-approve jobs error", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to auto-approve jobs");
  }
});
