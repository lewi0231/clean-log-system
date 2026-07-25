import { serve } from "server";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { checkRateLimit, RATE_LIMIT_CONFIGS, rateLimitResponse } from "../_utils/rate-limit.ts";
import {
  resolveFeedbackLandingMode,
  resolveFeedbackLandingPublicUrl,
} from "../_utils/feedback-review-landing.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "get-job-by-token" });

  // Rate limiting for public job access
  const rateLimitResult = await checkRateLimit(req, {
    ...RATE_LIMIT_CONFIGS.lenient,
    identifier: undefined, // Use IP address
  });

  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded", {
      remaining: rateLimitResult.remaining,
      retry_after: rateLimitResult.retryAfter,
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    // Allow GET requests with token in query params or POST with body
    let token: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else {
      const body = await req.json();
      const validation = validateRequiredFields(body, ["token"]);

      if (!validation.valid) {
        return errorResponse("Token is required", 400);
      }

      token = body.token;
    }

    if (!token || typeof token !== "string") {
      return errorResponse("Token is required", 400);
    }

    const supabase = createServiceRoleClient();

    // Fetch job by token with location, workers, org rating + feedback destination
    const { data: job, error: jobError } = await supabase
      .from("job")
      .select(
        `
        id,
        organization_id,
        completed_at,
        approval_status,
        feedback_mode_at_send,
        public_review_url_at_send,
        location:location_id (
          id,
          name,
          email
        ),
        job_worker:job_worker (
          worker:worker_id (
            id,
            name
          )
        ),
        organization:organization_id (
          rating_config,
          feedback_request_mode,
          public_review_url
        )
      `
      )
      .eq("feedback_token", token)
      .single();

    if (jobError || !job) {
      logger.warn("Job not found by token", {
        has_token: !!token,
        error: jobError,
      });
      // HTTP 404 preserves API contract; clients read message from error body
      return errorResponse("This review link is no longer available.", 404);
    }

    const approvalStatus =
      typeof job.approval_status === "string" ? job.approval_status : "approved";
    if (approvalStatus === "flagged" || approvalStatus === "cancelled") {
      return jsonResponse({
        success: false,
        error: "This job is no longer accepting feedback.",
        reject_reason: approvalStatus,
        job: {
          id: job.id,
          approval_status: approvalStatus,
        },
      });
    }

    // Check if feedback already exists for this job
    const { data: existingFeedback } = await supabase
      .from("feedback")
      .select("id")
      .eq("job_id", job.id)
      .maybeSingle();

    // Format workers array
    const workers = (job.job_worker || [])
      .map((jw: { worker: unknown }) => {
        const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
        return worker;
      })
      .filter((w: unknown) => w !== null && w !== undefined);

    // Format location
    const location = Array.isArray(job.location) ? job.location[0] : job.location;

    // Parse rating_config with default fallback
    let ratingConfig = {
      type: "single" as const,
      dimensions: ["overall"],
    };
    const orgData = Array.isArray(job.organization) ? job.organization[0] : job.organization;
    if (orgData?.rating_config) {
      try {
        const parsed =
          typeof orgData.rating_config === "string"
            ? JSON.parse(orgData.rating_config)
            : orgData.rating_config;
        if (parsed && typeof parsed === "object" && "type" in parsed && "dimensions" in parsed) {
          ratingConfig = parsed;
        }
      } catch {
        // Use default if parsing fails
      }
    }

    const feedbackRequestMode = resolveFeedbackLandingMode({
      modeAtSend: job.feedback_mode_at_send,
      liveMode: orgData?.feedback_request_mode,
    });
    const publicReviewUrl = resolveFeedbackLandingPublicUrl({
      urlAtSend: job.public_review_url_at_send,
      livePublicUrl: orgData?.public_review_url,
    });

    return jsonResponse({
      success: true,
      reject_reason: "ok",
      job: {
        id: job.id,
        completed_at: job.completed_at,
        location: location || null,
        workers: workers || [],
        hasFeedback: !!existingFeedback,
        rating_config: ratingConfig,
        approval_status: approvalStatus,
        feedback_request_mode: feedbackRequestMode,
        public_review_url: publicReviewUrl,
      },
    });
  } catch (error) {
    logger.error("Get job by token error", error);
    const errorMessage = extractErrorMessage(error, "Failed to get job details");
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
