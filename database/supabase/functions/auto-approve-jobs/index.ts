import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLoggerWithoutRequest } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

/**
 * auto-approve-jobs
 *
 * Scheduled function that runs periodically to auto-approve jobs
 * that have passed their auto_approve_at timestamp without action.
 *
 * This function should be triggered by a cron job (e.g., every 5 minutes).
 *
 * Cron setup in Supabase:
 *   SELECT cron.schedule(
 *     'auto-approve-jobs',
 *     '*/5 * * * *',
 *     $$SELECT extensions.http_post(
 *       'https://<project-ref>.supabase.co/functions/v1/auto-approve-jobs',
 *       '{}',
 *       'application/json'
 *     )$$
 *   );
 */
serve(async (req) => {
  const logger = createLoggerWithoutRequest({ functionName: "auto-approve-jobs" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    logger.debug("Starting auto-approve job scan", { now });

    // Find all jobs that:
    // 1. Have approval_status = 'pending'
    // 2. Have auto_approve_at <= now
    // (Flagged jobs are NOT auto-approved - they require admin resolution)
    const { data: jobsToApprove, error: fetchError } = await supabase
      .from("job")
      .select(`
        id,
        organization_id,
        submitted_by_worker_id,
        location:location_id (name)
      `)
      .eq("approval_status", "pending")
      .lte("auto_approve_at", now);

    if (fetchError) {
      logger.error("Error fetching jobs to auto-approve", fetchError);
      throw fetchError;
    }

    if (!jobsToApprove || jobsToApprove.length === 0) {
      logger.debug("No jobs to auto-approve");
      return jsonResponse({
        success: true,
        message: "No jobs to auto-approve",
        jobs_approved: 0,
      });
    }

    logger.info("Found jobs to auto-approve", {
      count: jobsToApprove.length,
      jobIds: jobsToApprove.map((j) => j.id),
    });

    const jobIds = jobsToApprove.map((j) => j.id);

    // Update job status to approved
    const { error: jobUpdateError } = await supabase
      .from("job")
      .update({ approval_status: "approved" })
      .in("id", jobIds);

    if (jobUpdateError) {
      logger.error("Error updating job status", jobUpdateError);
      throw jobUpdateError;
    }

    // Update all pending job_worker entries to confirmed
    const confirmedAt = now;
    const { error: workerUpdateError } = await supabase
      .from("job_worker")
      .update({
        confirmation_status: "confirmed",
        confirmed_at: confirmedAt,
      })
      .in("job_id", jobIds)
      .eq("confirmation_status", "pending");

    if (workerUpdateError) {
      logger.warn("Error updating job_worker status", {
        error: workerUpdateError.message,
      });
      // Don't fail - jobs were approved
    }

    // Send notifications for each auto-approved job
    for (const job of jobsToApprove) {
      try {
        const locationName = job.location?.name || "Unknown location";
        
        // Notify admins
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
          error: notificationError instanceof Error
            ? notificationError.message
            : "Unknown error",
        });
        // Continue with other jobs
      }
    }

    logger.info("Auto-approve completed", {
      jobsApproved: jobsToApprove.length,
    });

    return jsonResponse({
      success: true,
      message: `Auto-approved ${jobsToApprove.length} job(s)`,
      jobs_approved: jobsToApprove.length,
      job_ids: jobIds,
    });
  } catch (error) {
    logger.error("Auto-approve jobs error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to auto-approve jobs"
    );
  }
});
