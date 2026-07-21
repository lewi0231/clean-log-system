import { serve } from "server";
import { enqueueOrSendFeedback } from "../_utils/feedback-send.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireOrgAdminFromRequest } from "../_utils/org-sending-domain-edge.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "send-feedback-email" });

  try {
    const supabaseAdmin = createServiceRoleClient();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error("Failed to parse request body", parseError);
      return errorResponse("Invalid request body", 400);
    }

    const job_id = body.job_id;
    if (!job_id || typeof job_id !== "string") {
      return errorResponse("job_id is required", 400);
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("job")
      .select("id, organization_id")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return errorResponse("Job not found", 404);
    }

    if (body.organization_id != null && body.organization_id !== job.organization_id) {
      return errorResponse("organization_id does not match job", 400);
    }

    const gate = await requireOrgAdminFromRequest(req, job.organization_id, supabaseAdmin, body);
    if (!gate.ok) {
      return errorResponse(gate.message, gate.status);
    }

    const result = await enqueueOrSendFeedback(supabaseAdmin, job.id, {
      path: "manual",
      confirmFlagged: body.confirm_flagged === true,
      confirmTest: body.confirm_test === true,
      confirmResend: body.confirm_resend === true,
      isResend: body.confirm_resend === true,
    });

    if (result.error_code === "edit_window_open") {
      return errorResponse("Feedback can’t be sent until the edit window ends", 400);
    }
    if (result.error_code === "confirm_flagged_required") {
      return errorResponse("Flagged job requires confirm_flagged: true", 400);
    }
    if (result.error_code === "confirm_test_required") {
      return errorResponse("Test job requires confirm_test: true", 400);
    }
    if (result.error_code === "confirm_resend_required") {
      return errorResponse("Already sent — confirm_resend: true required", 400);
    }
    if (result.error_code === "job_cancelled") {
      return errorResponse("Cancelled jobs cannot receive feedback requests", 400);
    }
    if (result.error_code === "no_recipient") {
      return errorResponse(
        "No email recipient found. Please configure location email, form field email, or default email.",
        400
      );
    }
    if (result.error_code === "feedback_already_submitted") {
      return errorResponse("Private feedback already submitted for this job", 400);
    }
    if (result.error_code === "missing_public_review_url") {
      return errorResponse(
        "Public review URL (https) is required for the current feedback mode",
        400
      );
    }
    if (
      result.error_code === "feedback_requests_disabled" ||
      (result.skipped && result.reason === "feedback_requests_disabled")
    ) {
      return errorResponse("Feedback requests are disabled for this organization", 400);
    }
    if (
      result.error_code === "location_muted" ||
      (result.skipped && result.reason === "location_muted")
    ) {
      return errorResponse("Feedback requests are muted for this location", 400);
    }
    if (result.error_code === "feedback_lookup_failed") {
      return errorResponse("Could not verify existing feedback — try again shortly", 503);
    }

    if (result.sent || result.queued) {
      return jsonResponse(
        {
          success: true,
          message: result.sent ? "Feedback email sent successfully" : "Feedback email queued",
          emailId: result.emailId,
          outboxId: result.outboxId,
          status: result.status,
        },
        200
      );
    }

    return errorResponse(result.reason || "Failed to send feedback email", 500);
  } catch (error) {
    logger.error("Send feedback email error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to send feedback email"),
      getErrorStatusCode(error)
    );
  }
});
