import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { autoGenerateInvoiceForJob } from "../_utils/auto-invoice.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

/**
 * confirm-job-participation
 *
 * Allows a worker to confirm their participation in a job they were added to as a colleague.
 * If all workers have confirmed, the job is automatically approved.
 */
serve(async (req) => {
  const logger = createLogger(req, { functionName: "confirm-job-participation" });
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
      return errorResponse("Only workers can confirm job participation", 403);
    }

    // Parse request body
    const body = await req.json();
    const validation = validateRequiredFields(body, ["job_id"]);
    if (!validation.valid) {
      return errorResponse("job_id is required", 400);
    }

    const { job_id } = body;

    logger.debug("Confirming job participation", {
      workerId,
      jobId: job_id,
    });

    // Get the job and verify it's in pending status
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select("id, organization_id, approval_status, location_id, location:location_id (name)")
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
        `Cannot confirm participation on a job with status: ${job.approval_status}`,
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

    if (jobWorker.confirmation_status === "confirmed") {
      logger.debug("Worker already confirmed", { workerId, jobId: job_id });
      return jsonResponse({
        success: true,
        message: "Already confirmed",
        job_approved: false,
      });
    }

    if (jobWorker.confirmation_status === "flagged") {
      logger.warn("Worker has flagged this job", { workerId, jobId: job_id });
      return errorResponse("You have already flagged this job", 400);
    }

    // Update the job_worker confirmation status
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("job_worker")
      .update({
        confirmation_status: "confirmed",
        confirmed_at: now,
      })
      .eq("job_id", job_id)
      .eq("worker_id", workerId);

    if (updateError) {
      logger.error("Failed to update job_worker", updateError, {
        workerId,
        jobId: job_id,
      });
      throw updateError;
    }

    logger.info("Worker confirmed participation", {
      workerId,
      jobId: job_id,
    });

    // Check if all workers have now confirmed
    const { data: pendingWorkers, error: pendingError } = await supabase
      .from("job_worker")
      .select("worker_id")
      .eq("job_id", job_id)
      .eq("confirmation_status", "pending");

    if (pendingError) {
      logger.warn("Failed to check pending workers", {
        error: pendingError.message,
      });
      // Don't fail - the confirmation was successful
      return jsonResponse({
        success: true,
        message: "Participation confirmed",
        job_approved: false,
      });
    }

    // If no more pending workers, approve the job
    if (!pendingWorkers || pendingWorkers.length === 0) {
      const { error: approveError } = await supabase
        .from("job")
        .update({ approval_status: "approved" })
        .eq("id", job_id);

      if (approveError) {
        logger.warn("Failed to approve job", { error: approveError.message });
        // Don't fail - the confirmation was successful
        return jsonResponse({
          success: true,
          message: "Participation confirmed",
          job_approved: false,
        });
      }

      logger.info("Job auto-approved after all workers confirmed", {
        jobId: job_id,
      });

      // Notify admins that the job was approved (all colleagues confirmed)
      const location = Array.isArray(job.location) ? job.location[0] : job.location;
      const locationName = (location as { name?: string } | null)?.name ?? "Unknown location";
      const notificationResult = await createNotification(supabase, {
        organization_id: job.organization_id,
        type: "job_colleagues_confirmed",
        title: "Job Approved",
        message: `All colleagues have confirmed. Job at ${locationName} is now approved.`,
        related_entity_type: "job",
        related_entity_id: job_id,
      });
      if (!notificationResult.success) {
        logger.warn("Failed to create job_colleagues_confirmed notification", {
          jobId: job_id,
          error: notificationResult.error,
        });
      }

      // Auto-generate invoice if org has the setting enabled (job is now approved and completed)
      try {
        const autoInvoiceResult = await autoGenerateInvoiceForJob({
          jobId: job_id,
          organizationId: job.organization_id,
          locationId: job.location_id,
          supabaseAdmin: supabase,
          logger,
        });
        if (autoInvoiceResult.skipped) {
          logger.debug("Auto-invoice skipped after colleague confirmation", {
            jobId: job_id,
            reason: autoInvoiceResult.skipReason,
          });
        } else if (!autoInvoiceResult.success) {
          logger.warn("Auto-invoice failed after colleague confirmation", {
            jobId: job_id,
            error: autoInvoiceResult.error,
          });
        }
      } catch (invoiceErr) {
        logger.warn("Auto-invoice error after colleague confirmation", {
          jobId: job_id,
          error: invoiceErr,
        });
      }

      return jsonResponse({
        success: true,
        message: "Participation confirmed. Job is now approved.",
        job_approved: true,
      });
    }

    return jsonResponse({
      success: true,
      message: "Participation confirmed",
      job_approved: false,
      pending_confirmations: pendingWorkers.length,
    });
  } catch (error) {
    logger.error("Confirm job participation error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to confirm participation"
    );
  }
});
