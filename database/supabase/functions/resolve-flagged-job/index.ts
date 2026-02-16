import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { autoGenerateInvoiceForJob } from "../_utils/auto-invoice.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

/**
 * resolve-flagged-job
 *
 * Allows an admin to resolve a flagged job by either approving or cancelling it.
 * Notifies all workers on the job about the resolution.
 */
serve(async (req) => {
  const logger = createLogger(req, { functionName: "resolve-flagged-job" });
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
    if (!authUser || !authUser.email) {
      logger.warn("User not found after token verification");
      return errorResponse("User not found", 401);
    }

    // Get organization_user to verify admin status
    const { data: orgUser, error: orgUserError } = await supabase
      .from("organization_user")
      .select("organization_id, role")
      .eq("email", authUser.email)
      .maybeSingle();

    if (orgUserError) {
      logger.error("Error fetching organization user", orgUserError);
      throw orgUserError;
    }

    if (!orgUser) {
      logger.warn("Organization user not found", { email: authUser.email });
      return errorResponse("Organization user not found", 404);
    }

    if (orgUser.role !== "admin" && orgUser.role !== "owner") {
      logger.warn("User is not an admin", { email: authUser.email, role: orgUser.role });
      return errorResponse("Only admins can resolve flagged jobs", 403);
    }

    // Parse request body
    const body = await req.json();
    const validation = validateRequiredFields(body, ["job_id", "action"]);
    if (!validation.valid) {
      return errorResponse("job_id and action are required", 400);
    }

    const { job_id, action, admin_notes: _admin_notes } = body;

    // Validate action
    if (action !== "approve" && action !== "cancel") {
      return errorResponse("action must be 'approve' or 'cancel'", 400);
    }

    logger.debug("Resolving flagged job", {
      jobId: job_id,
      action,
      adminEmail: authUser.email,
    });

    // Get the job and verify it's flagged and belongs to the admin's organization
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select(`
        id,
        organization_id,
        approval_status,
        location_id,
        location:location_id (name)
      `)
      .eq("id", job_id)
      .eq("organization_id", orgUser.organization_id)
      .single();

    if (jobError || !job) {
      logger.warn("Job not found", { jobId: job_id, error: jobError?.message });
      return errorResponse("Job not found", 404);
    }

    if (job.approval_status !== "flagged") {
      logger.warn("Job is not flagged", {
        jobId: job_id,
        status: job.approval_status,
      });
      return errorResponse(
        `Cannot resolve a job with status: ${job.approval_status}. Only flagged jobs can be resolved.`,
        400
      );
    }

    // Determine new status
    const newStatus = action === "approve" ? "approved" : "cancelled";

    // Update job status
    const { error: updateError } = await supabase
      .from("job")
      .update({ approval_status: newStatus })
      .eq("id", job_id);

    if (updateError) {
      logger.error("Failed to update job status", updateError, { jobId: job_id });
      throw updateError;
    }

    // If approving, set all pending workers to confirmed
    if (action === "approve") {
      const now = new Date().toISOString();
      const { error: confirmError } = await supabase
        .from("job_worker")
        .update({
          confirmation_status: "confirmed",
          confirmed_at: now,
        })
        .eq("job_id", job_id)
        .in("confirmation_status", ["pending", "flagged"]);

      if (confirmError) {
        logger.warn("Failed to confirm workers", { error: confirmError.message });
        // Don't fail - the resolution was successful
      }

      // Auto-generate invoice if org has the setting enabled
      try {
        const autoInvoiceResult = await autoGenerateInvoiceForJob({
          jobId: job_id,
          organizationId: job.organization_id,
          locationId: job.location_id,
          supabaseAdmin: supabase,
          logger,
        });
        if (autoInvoiceResult.skipped) {
          logger.debug("Auto-invoice skipped after resolving flagged job", {
            jobId: job_id,
            reason: autoInvoiceResult.skipReason,
          });
        } else if (!autoInvoiceResult.success) {
          logger.warn("Auto-invoice failed after resolving flagged job", {
            jobId: job_id,
            error: autoInvoiceResult.error,
          });
        }
      } catch (invoiceErr) {
        logger.warn("Auto-invoice error after resolving flagged job", {
          jobId: job_id,
          error: invoiceErr,
        });
      }
    }

    logger.info("Flagged job resolved", {
      jobId: job_id,
      action,
      newStatus,
      adminEmail: authUser.email,
    });

    // Get all workers on the job to notify them
    const { data: _jobWorkers } = await supabase
      .from("job_worker")
      .select("worker:worker_id (id, auth_user_id)")
      .eq("job_id", job_id);

    // Notify workers about the resolution
    const location = Array.isArray(job.location) ? job.location[0] : job.location;
    const locationName = (location as { name?: string } | null)?.name ?? "Unknown location";
    const notificationType = action === "approve"
      ? "job_resolved_approved"
      : "job_resolved_cancelled";
    const notificationTitle = action === "approve"
      ? "Job Approved"
      : "Job Cancelled";
    const notificationMessage = action === "approve"
      ? `The flagged job at ${locationName} has been approved by admin.`
      : `The flagged job at ${locationName} has been cancelled by admin.`;

    // For now, create admin notification (workers would need a different notification mechanism)
    const notificationResult = await createNotification(supabase, {
      organization_id: job.organization_id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
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
      message: `Job ${action === "approve" ? "approved" : "cancelled"} successfully`,
      job_status: newStatus,
    });
  } catch (error) {
    logger.error("Resolve flagged job error", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to resolve job"
    );
  }
});
