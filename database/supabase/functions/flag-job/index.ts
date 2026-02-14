import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

/**
 * flag-job
 *
 * Allows a worker to flag a job they were added to as a colleague.
 * This marks the job as needing admin review and notifies all admins.
 */
serve(async (req) => {
  const logger = createLogger(req, { functionName: "flag-job" });
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
      return errorResponse("Only workers can flag jobs", 403);
    }

    // Parse request body
    const body = await req.json();
    const validation = validateRequiredFields(body, ["job_id", "reason"]);
    if (!validation.valid) {
      return errorResponse("job_id and reason are required", 400);
    }

    const { job_id, reason } = body;

    // Validate reason length
    if (typeof reason !== "string" || reason.trim().length < 10) {
      return errorResponse("Reason must be at least 10 characters", 400);
    }

    const trimmedReason = reason.trim();

    logger.debug("Flagging job", {
      workerId,
      jobId: job_id,
      reasonLength: trimmedReason.length,
    });

    // Get the job and verify it's in pending status
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select(`
        id,
        organization_id,
        approval_status,
        location:location_id (name)
      `)
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      logger.warn("Job not found", { jobId: job_id, error: jobError?.message });
      return errorResponse("Job not found", 404);
    }

    if (job.approval_status !== "pending") {
      logger.warn("Job is not in pending status", {
        jobId: job_id,
        status: job.approval_status,
      });
      return errorResponse(
        `Cannot flag a job with status: ${job.approval_status}`,
        400
      );
    }

    // Get the job_worker record for this worker
    const { data: jobWorker, error: jwError } = await supabase
      .from("job_worker")
      .select("job_id, worker_id, confirmation_status")
      .eq("job_id", job_id)
      .eq("worker_id", workerId)
      .single();

    if (jwError || !jobWorker) {
      logger.warn("Worker not assigned to this job", {
        workerId,
        jobId: job_id,
        error: jwError?.message,
      });
      return errorResponse("You are not assigned to this job", 403);
    }

    if (jobWorker.confirmation_status === "flagged") {
      logger.debug("Worker already flagged this job", { workerId, jobId: job_id });
      return jsonResponse({
        success: true,
        message: "Already flagged",
      });
    }

    // Get worker name for notification
    const { data: worker } = await supabase
      .from("worker")
      .select("first_name, last_name")
      .eq("id", workerId)
      .single();

    const workerName = worker
      ? `${worker.first_name} ${worker.last_name}`.trim()
      : "A worker";

    // Update the job_worker confirmation status to flagged
    const now = new Date().toISOString();
    const { error: updateJwError } = await supabase
      .from("job_worker")
      .update({
        confirmation_status: "flagged",
        flagged_at: now,
        flag_reason: trimmedReason,
      })
      .eq("job_id", job_id)
      .eq("worker_id", workerId);

    if (updateJwError) {
      logger.error("Failed to update job_worker", updateJwError, {
        workerId,
        jobId: job_id,
      });
      throw updateJwError;
    }

    // Update job status to flagged
    const { error: updateJobError } = await supabase
      .from("job")
      .update({ approval_status: "flagged" })
      .eq("id", job_id);

    if (updateJobError) {
      logger.error("Failed to update job status", updateJobError, {
        jobId: job_id,
      });
      throw updateJobError;
    }

    logger.info("Job flagged by worker", {
      workerId,
      jobId: job_id,
      reason: trimmedReason,
    });

    // Notify all admins about the flagged job
    const locationName = job.location?.name || "Unknown location";
    const notificationResult = await createNotification(supabase, {
      organization_id: job.organization_id,
      type: "job_flagged",
      title: "Job Flagged for Review",
      message: `${workerName} flagged a job at ${locationName}: "${trimmedReason.substring(0, 100)}${trimmedReason.length > 100 ? "..." : ""}"`,
      related_entity_type: "job",
      related_entity_id: job_id,
    });

    if (!notificationResult.success) {
      logger.warn("Failed to create notification", {
        error: notificationResult.error,
      });
    }

    return jsonResponse({
      success: true,
      message: "Job flagged for admin review",
    });
  } catch (error) {
    logger.error("Flag job error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to flag job"
    );
  }
});
