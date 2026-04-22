import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import {
  type FeedbackEmailData,
  generateFeedbackToken,
  getFeedbackEmailRecipient,
  sendFeedbackRequestEmail,
} from "../_utils/feedback-email.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import type {
  InvoiceEmailRecipientConfig,
  JobContext,
} from "../_utils/invoice-email.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "send-feedback-email" });

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    if (!token) {
      logger.warn("No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser) {
      logger.error("User not found after token verification", undefined);
      return errorResponse("User not found", 401);
    }

    const authUserId = authUser.id;
    logger.debug("Token verified", {
      user_id: authUserId,
      user_email: authUser.email,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error("Failed to parse request body", parseError);
      return errorResponse("Invalid request body", 400);
    }

    const { job_id } = body;

    if (!job_id || typeof job_id !== "string") {
      logger.warn("Invalid job_id", {
        job_id: job_id,
        type: typeof job_id,
      });
      return errorResponse("job_id is required", 400);
    }

    // Fetch job with organization and location details
    const { data: job, error: jobError } = await supabaseAdmin
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        submission_data,
        completed_at,
        feedback_token,
        feedback_email_sent,
        feedback_email_sent_at,
        location:location_id (
          id,
          email,
          contact_person,
          name,
          hierarchy_parent_id
        )
      `,
      )
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      logger.error("Job not found", jobError, {
        job_id: job_id,
      });
      return errorResponse("Job not found", 404);
    }

    logger.debug("Job found", {
      job_id: job.id,
      organization_id: job.organization_id,
      has_location: !!job.location,
    });

    // Verify user has access to this job's organization
    // Get user's organization from organization_user table
    const { data: orgUser, error: orgUserError } = await supabaseAdmin
      .from("organization_user")
      .select("organization_id")
      .eq("user_id", authUserId)
      .eq("organization_id", job.organization_id)
      .maybeSingle();

    if (orgUserError) {
      logger.error("Error checking organization access", orgUserError, {
        user_id: authUserId,
        organization_id: job.organization_id,
      });
      throw orgUserError;
    }

    if (!orgUser) {
      logger.warn("User does not have access to this organization", {
        user_id: authUserId,
        organization_id: job.organization_id,
      });
      return errorResponse("Access denied", 403);
    }

    // Fetch organization settings
    const { data: orgSettings, error: orgSettingsError } = await supabaseAdmin
      .from("organization")
      .select("name")
      .eq("id", job.organization_id)
      .single();

    if (orgSettingsError) {
      logger.error("Error fetching organization", orgSettingsError, {
        organization_id: job.organization_id,
      });
      throw orgSettingsError;
    }

    // Generate or use existing feedback token
    let feedbackToken = job.feedback_token;
    if (!feedbackToken) {
      feedbackToken = generateFeedbackToken();
      logger.debug("Generated new feedback token", {
        job_id: job.id,
      });

      // Update job with token
      const { error: updateTokenError } = await supabaseAdmin
        .from("job")
        .update({ feedback_token: feedbackToken })
        .eq("id", job.id);

      if (updateTokenError) {
        logger.error("Error updating job with token", updateTokenError, {
          job_id: job.id,
        });
        throw updateTokenError;
      }
    } else {
      logger.debug("Using existing feedback token", {
        job_id: job.id,
      });
    }

    // Fetch invoice template config for email recipient configuration
    const { data: templateConfig } = await supabaseAdmin
      .from("invoice_template_config")
      .select("email_recipient_config")
      .eq("organization_id", job.organization_id)
      .single();

    const emailConfig: InvoiceEmailRecipientConfig = (templateConfig
      ?.email_recipient_config as InvoiceEmailRecipientConfig) || {
      location_email_source: "location_email",
      form_field_email: null,
      default_email: null,
    };

    // Fetch field configs for form field email mapping
    const { data: fieldConfigs } = await supabaseAdmin
      .from("organization_field_configs")
      .select("id, name")
      .eq("organization_id", job.organization_id)
      .eq("active", true);

    const fieldConfigMap = new Map<string, { name: string }>(
      (fieldConfigs || []).map(
        (fc: { id: string; name: string }) => [fc.id, { name: fc.name }],
      ),
    );

    // Handle location (Supabase returns it as array or object depending on query)
    const locationData = Array.isArray(job.location)
      ? job.location[0]
      : job.location;

    // Build job context for email recipient determination
    const jobContext: JobContext = {
      location_id: job.location_id,
      location: locationData
        ? {
          id: locationData.id,
          email: locationData.email || null,
          contact_person: locationData.contact_person || null,
          hierarchy_parent_id: locationData.hierarchy_parent_id || null,
        }
        : null,
      submission_data: job.submission_data as
        | Record<string, unknown>
        | null,
    };

    // Get email recipient
    const recipientEmail = await getFeedbackEmailRecipient(
      supabaseAdmin,
      jobContext,
      emailConfig,
      fieldConfigMap,
    );

    if (!recipientEmail) {
      logger.warn("No feedback email recipient found", {
        job_id: job.id,
        location_id: job.location_id,
      });
      return errorResponse(
        "No email recipient found. Please configure location email, form field email, or default email.",
        400,
      );
    }

    logger.debug("Found feedback email recipient", {
      recipient_email: recipientEmail,
      job_id: job.id,
    });

    // Get recipient name (from location contact_person or default)
    const recipientName = locationData?.contact_person || null;

    // Build feedback email data
    const feedbackEmailData: FeedbackEmailData = {
      recipientEmail,
      recipientName,
      organizationName: orgSettings.name || "Our Team",
      organizationId: job.organization_id,
      jobId: job.id,
      jobCompletedAt: job.completed_at,
      locationName: locationData?.name || null,
      feedbackToken,
      feedbackReviewUrl: "", // Will be set by sendFeedbackRequestEmail
    };

    // Send feedback email
    const emailResult = await sendFeedbackRequestEmail(
      supabaseAdmin,
      feedbackEmailData,
      false, // Don't throw on error - return error response instead
    );

    if (emailResult.success) {
      logger.info("Feedback email sent successfully", {
        email_id: emailResult.emailId,
        job_id: job.id,
        recipient_email: recipientEmail,
      });

      // Update job with email tracking
      const { error: updateError } = await supabaseAdmin
        .from("job")
        .update({
          feedback_token: feedbackToken,
          feedback_email_sent: true,
          feedback_email_sent_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (updateError) {
        logger.warn("Error updating job with feedback email tracking", {
          job_id: job.id,
          error: updateError,
        });
        // Email was sent, so this is non-critical - still return success
      }

      return jsonResponse(
        {
          success: true,
          message: "Feedback email sent successfully",
          emailId: emailResult.emailId,
        },
        200,
      );
    } else {
      logger.error("Failed to send feedback email", undefined, {
        job_id: job.id,
        recipient_email: recipientEmail,
        error: emailResult.error,
      });
      return errorResponse(
        emailResult.error || "Failed to send feedback email",
        500,
      );
    }
  } catch (error) {
    logger.error("Send feedback email error", error);
    const errorMessage = extractErrorMessage(
      error,
      "Failed to send feedback email",
    );
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
