import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

/**
 * withdraw-job
 *
 * Allows the submitting worker to withdraw a job they submitted within the edit window (3 hours).
 * This deletes the job and notifies colleagues that were added to it.
 */
serve(async (req) => {
  const logger = createLogger(req, { functionName: "withdraw-job" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
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

    // Get worker ID from auth user metadata
    const workerId = authUser.user_metadata?.worker_id;
    if (!workerId) {
      logger.warn("User is not a worker", { userId: authUser.id });
      return errorResponse("Only workers can withdraw jobs", 403);
    }

    // Parse request body
    const body = await req.json();
    const validation = validateRequiredFields(body, ["job_id"]);
    if (!validation.valid) {
      return errorResponse("job_id is required", 400);
    }

    const { job_id } = body;

    logger.debug("Withdrawing job", {
      workerId,
      jobId: job_id,
    });

    // Get the job and verify the worker is the submitter
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select(`
        id,
        organization_id,
        approval_status,
        submitted_by_worker_id,
        edit_window_expires_at,
        location:location_id (name)
      `)
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      logger.warn("Job not found", { jobId: job_id, error: jobError?.message });
      return errorResponse("Job not found", 404);
    }

    // Verify the worker is the submitter
    if (job.submitted_by_worker_id !== workerId) {
      logger.warn("Worker is not the submitter", {
        workerId,
        submitterId: job.submitted_by_worker_id,
        jobId: job_id,
      });
      return errorResponse("Only the worker who submitted this job can withdraw it", 403);
    }

    // Verify job is still in pending status
    if (job.approval_status !== "pending") {
      logger.warn("Job is not in pending status", {
        jobId: job_id,
        status: job.approval_status,
      });
      return errorResponse(
        `Cannot withdraw a job with status: ${job.approval_status}`,
        400
      );
    }

    // Verify within edit window
    if (job.edit_window_expires_at) {
      const editWindowExpires = new Date(job.edit_window_expires_at);
      const now = new Date();
      if (now > editWindowExpires) {
        logger.warn("Edit window has expired", {
          jobId: job_id,
          editWindowExpires: job.edit_window_expires_at,
          now: now.toISOString(),
        });
        return errorResponse(
          "The edit window has expired. You can no longer withdraw this job.",
          400
        );
      }
    }

    // Get worker name for notification
    const { data: submitter } = await supabase
      .from("worker")
      .select("first_name, last_name")
      .eq("id", workerId)
      .single();

    const submitterName = submitter
      ? `${submitter.first_name} ${submitter.last_name}`.trim()
      : "The submitter";

    // Get other workers on the job (excluding the submitter) for notification
    const { data: colleagues } = await supabase
      .from("job_worker")
      .select("worker_id")
      .eq("job_id", job_id)
      .neq("worker_id", workerId);

    // Delete the job (this will cascade delete job_worker entries due to FK constraint)
    const { error: deleteError } = await supabase
      .from("job")
      .delete()
      .eq("id", job_id);

    if (deleteError) {
      logger.error("Failed to delete job", deleteError, { jobId: job_id });
      throw deleteError;
    }

    logger.info("Job withdrawn successfully", {
      workerId,
      jobId: job_id,
      colleaguesNotified: colleagues?.length || 0,
    });

    // Notify colleagues about the withdrawal
    if (colleagues && colleagues.length > 0) {
      const locationName = job.location?.name || "a location";
      const notificationResult = await createNotification(supabase, {
        organization_id: job.organization_id,
        type: "job_withdrawn",
        title: "Job Withdrawn",
        message: `${submitterName} withdrew the job at ${locationName} that you were added to.`,
        related_entity_type: "job",
        related_entity_id: job_id,
      });

      if (!notificationResult.success) {
        logger.warn("Failed to create notification", {
          error: notificationResult.error,
        });
      }
    }

    return jsonResponse({
      success: true,
      message: "Job withdrawn successfully",
    });
  } catch (error) {
    logger.error("Withdraw job error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to withdraw job"
    );
  }
});
