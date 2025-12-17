import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import {
  type FeedbackEmailData,
  generateFeedbackToken,
  getFeedbackEmailRecipient,
  sendFeedbackRequestEmail,
} from "../_utils/feedback-email.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import type {
  InvoiceEmailRecipientConfig,
  JobContext,
} from "../_utils/invoice-email.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  console.log("📥 Send Feedback Email: Request received", {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.get("authorization"),
  });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    console.log("🔐 Send Feedback Email: Authentication check", {
      hasToken: !!token,
      tokenLength: token?.length || 0,
    });

    if (!token) {
      console.error("❌ Send Feedback Email: No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser) {
      console.error(
        "❌ Send Feedback Email: User not found after token verification",
      );
      return errorResponse("User not found", 401);
    }

    const authUserId = authUser.id;
    console.log("✅ Send Feedback Email: Token verified", {
      userId: authUserId,
      email: authUser.email,
    });

    // Parse request body
    console.log("📦 Send Feedback Email: Parsing request body");
    let body;
    try {
      body = await req.json();
      console.log("📦 Send Feedback Email: Request body parsed", {
        hasJobId: !!body.job_id,
        jobId: body.job_id,
      });
    } catch (parseError) {
      console.error("❌ Send Feedback Email: Failed to parse request body", {
        error: parseError instanceof Error
          ? parseError.message
          : String(parseError),
      });
      return errorResponse("Invalid request body", 400);
    }

    const { job_id } = body;

    if (!job_id || typeof job_id !== "string") {
      console.error("❌ Send Feedback Email: Invalid job_id", {
        jobId: job_id,
        type: typeof job_id,
      });
      return errorResponse("job_id is required", 400);
    }

    // Fetch job with organization and location details
    console.log("📋 Send Feedback Email: Fetching job", {
      jobId: job_id,
    });
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
      console.error("❌ Send Feedback Email: Job not found", {
        error: jobError?.message,
        jobId: job_id,
      });
      return errorResponse("Job not found", 404);
    }

    console.log("✅ Send Feedback Email: Job found", {
      jobId: job.id,
      organizationId: job.organization_id,
      hasLocation: !!job.location,
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
      console.error(
        "❌ Send Feedback Email: Error checking organization access",
        {
          error: orgUserError.message,
        },
      );
      throw orgUserError;
    }

    if (!orgUser) {
      console.error(
        "❌ Send Feedback Email: User does not have access to this organization",
        {
          userId: authUserId,
          organizationId: job.organization_id,
        },
      );
      return errorResponse("Access denied", 403);
    }

    console.log("✅ Send Feedback Email: Organization access verified");

    // Fetch organization settings
    const { data: orgSettings, error: orgSettingsError } = await supabaseAdmin
      .from("organization")
      .select("name")
      .eq("id", job.organization_id)
      .single();

    if (orgSettingsError) {
      console.error("❌ Send Feedback Email: Error fetching organization", {
        error: orgSettingsError.message,
      });
      throw orgSettingsError;
    }

    // Generate or use existing feedback token
    let feedbackToken = job.feedback_token;
    if (!feedbackToken) {
      feedbackToken = generateFeedbackToken();
      console.log("🔑 Send Feedback Email: Generated new feedback token", {
        tokenLength: feedbackToken.length,
      });

      // Update job with token
      const { error: updateTokenError } = await supabaseAdmin
        .from("job")
        .update({ feedback_token: feedbackToken })
        .eq("id", job.id);

      if (updateTokenError) {
        console.error("❌ Send Feedback Email: Error updating job with token", {
          error: updateTokenError.message,
        });
        throw updateTokenError;
      }
    } else {
      console.log("🔑 Send Feedback Email: Using existing feedback token");
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
      console.warn(
        "⚠️ Send Feedback Email: No feedback email recipient found",
        {
          jobId: job.id,
          locationId: job.location_id,
        },
      );
      return errorResponse(
        "No email recipient found. Please configure location email, form field email, or default email.",
        400,
      );
    }

    console.log("📧 Send Feedback Email: Found feedback email recipient", {
      email: recipientEmail,
    });

    // Get recipient name (from location contact_person or default)
    const recipientName = locationData?.contact_person || null;

    // Build feedback email data
    const feedbackEmailData: FeedbackEmailData = {
      recipientEmail,
      recipientName,
      organizationName: orgSettings.name || "Our Team",
      jobId: job.id,
      jobCompletedAt: job.completed_at,
      locationName: locationData?.name || null,
      feedbackToken,
      feedbackReviewUrl: "", // Will be set by sendFeedbackRequestEmail
    };

    // Send feedback email
    const emailResult = await sendFeedbackRequestEmail(
      feedbackEmailData,
      false, // Don't throw on error - return error response instead
    );

    if (emailResult.success) {
      console.log("✅ Send Feedback Email: Feedback email sent successfully", {
        emailId: emailResult.emailId,
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
        console.error(
          "❌ Send Feedback Email: Error updating job with feedback email tracking",
          {
            error: updateError.message,
          },
        );
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
      console.error("❌ Send Feedback Email: Failed to send feedback email", {
        error: emailResult.error,
      });
      return errorResponse(
        emailResult.error || "Failed to send feedback email",
        500,
      );
    }
  } catch (error) {
    const errorLog: Record<string, unknown> = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    };

    console.error("❌ Send Feedback Email: Unhandled error", errorLog);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send feedback email";

    return errorResponse(errorMessage, 500);
  }
});
