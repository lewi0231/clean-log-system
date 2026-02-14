import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const logger = createLogger(req, { functionName: "get-job-edits" });
  logger.debug("Request received", {
    method: req.method,
    hasAuthHeader: !!req.headers.get("authorization"),
  });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

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

    if (!authUser || !authUser.email) {
      logger.warn("User not found after token verification");
      return errorResponse("User not found", 401);
    }

    const userEmail = authUser.email;
    // Never log emails; the logger would mask them, but we avoid emitting them entirely.
    logger.debug("Token verified", { userId: authUser.id });

    // Get organization_id from organization_user table
    const { data: orgUser, error: orgUserError } = await supabaseAdmin
      .from("organization_user")
      .select("organization_id, role")
      .eq("email", userEmail)
      .maybeSingle();

    if (orgUserError) {
      logger.error("Error fetching organization user", orgUserError);
      throw orgUserError;
    }

    if (!orgUser) {
      logger.warn("Organization user not found");
      return errorResponse("Organization user not found", 404);
    }

    const organizationId = orgUser.organization_id;
    logger.debug("Organization user found", {
      organizationId,
      role: orgUser.role,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
      logger.debug("Request body parsed", { hasJobId: !!body.job_id });
    } catch (parseError) {
      logger.warn("Failed to parse request body", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return errorResponse("Invalid request body", 400);
    }

    // Validate required fields
    const validation = validateRequiredFields(body, ["job_id"]);
    if (!validation.valid) {
      return errorResponse("Job ID is required", 400);
    }

    const { job_id } = body;

    // Verify job exists and belongs to organization
    const { data: job, error: jobError } = await supabaseAdmin
      .from("job")
      .select("id, organization_id")
      .eq("id", job_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (jobError) {
      logger.error("Error fetching job", jobError);
      throw jobError;
    }

    if (!job) {
      logger.warn("Job not found or access denied", {
        jobId: job_id,
        organizationId,
      });
      return errorResponse(
        "Job not found or does not belong to your organization",
        404,
      );
    }

    // Fetch edit history for this job
    // Gracefully handle errors (e.g., if table doesn't exist yet)
    const { data: edits, error: editsError } = await supabaseAdmin
      .from("job_edits")
      .select("*")
      .eq("job_id", job_id)
      .order("changed_at", { ascending: false });

    if (editsError) {
      // Log error but don't fail - return empty array instead
      // This allows the feature to work even if migration hasn't been run
      logger.warn("Error fetching edit history; returning empty array", {
        error: editsError.message,
        code: editsError.code,
      });

      // Return empty array instead of failing
      return jsonResponse({
        success: true,
        edits: [],
      });
    }

    logger.debug("Edit history fetched", {
      jobId: job_id,
      editCount: edits?.length || 0,
    });

    return jsonResponse({
      success: true,
      edits: edits || [],
    });
  } catch (error) {
    logger.error("Unhandled error", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to fetch job edit history";

    let statusCode = 500;
    if (error instanceof Error) {
      if (
        error.message.includes("Authentication") ||
        error.message.includes("User not found")
      ) {
        statusCode = 401;
      } else if (error.message.includes("not found")) {
        statusCode = 404;
      } else if (
        error.message.includes("required") ||
        error.message.includes("invalid")
      ) {
        statusCode = 400;
      }
    }

    return errorResponse(errorMessage, statusCode);
  }
});
