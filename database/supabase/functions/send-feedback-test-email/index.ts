import { serve } from "server";
import {
  generateFeedbackToken,
  sendFeedbackRequestEmail,
  type FeedbackRequestMode,
} from "../_utils/feedback-email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireOrgAdminFromRequest } from "../_utils/org-sending-domain-edge.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const logger = createLogger(req, { functionName: "send-feedback-test-email" });
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id"]);
    if (!v.valid) {
      return errorResponse("organization_id is required", 400);
    }
    const organization_id = body.organization_id as string;

    const supabase = createServiceRoleClient();
    const gate = await requireOrgAdminFromRequest(req, organization_id, supabase, body);
    if (!gate.ok) {
      return errorResponse(gate.message, gate.status);
    }

    const { data: org, error: orgErr } = await supabase
      .from("organization")
      .select(
        "id, name, locale, feedback_request_mode, public_review_url, feedback_email_subject, feedback_email_body, feedback_email_reply_to, feedback_requests_enabled"
      )
      .eq("id", organization_id)
      .single();

    if (orgErr || !org) {
      return errorResponse("Organization not found", 404);
    }

    const mode = (org.feedback_request_mode || "internal") as FeedbackRequestMode;
    if (mode !== "internal") {
      const pub = (org.public_review_url || "").trim();
      if (!pub || !/^https:\/\//i.test(pub)) {
        return errorResponse(
          "public_review_url (https://) is required before sending a test email in public or both mode",
          400
        );
      }
    }

    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(gate.userId);
    if (authErr || !authUser.user?.email) {
      logger.error("Could not load admin email for feedback test send", authErr);
      return errorResponse("Could not determine your email address", 500);
    }
    const recipient = authUser.user.email;

    if (Deno.env.get("SKIP_EMAIL_SENDING") === "true") {
      logger.info("SKIP_EMAIL_SENDING: would send feedback test email", {
        to: recipient,
        organization_id,
        mode,
      });
      return jsonResponse({
        success: true,
        skipped: true,
        to: recipient,
      });
    }

    const token = mode === "public" ? null : generateFeedbackToken();
    const result = await sendFeedbackRequestEmail(
      supabase,
      {
        recipientEmail: recipient,
        recipientName: authUser.user.user_metadata?.full_name ?? "Admin",
        organizationName: org.name || "Organization",
        organizationId: organization_id,
        jobId: `test-${organization_id}`,
        jobCompletedAt: new Date().toISOString(),
        locationName: "Sample Location",
        feedbackToken: token,
        feedbackReviewUrl: "",
        mode,
        publicReviewUrl: org.public_review_url,
        subjectTemplate: org.feedback_email_subject,
        bodyTemplate: org.feedback_email_body,
        replyTo: org.feedback_email_reply_to,
        locale: org.locale || "en-AU",
        subjectPrefix: "[TEST]",
      },
      true
    );

    if (!result.success) {
      return errorResponse(result.error || "Failed to send test email", 500);
    }

    logger.info("Feedback test email sent", {
      organization_id,
      to: recipient,
      emailId: result.emailId,
    });

    return jsonResponse({
      success: true,
      to: recipient,
      email_id: result.emailId ?? null,
    });
  } catch (error) {
    logger.error("send-feedback-test-email failed", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to send test email", 500);
  }
});
