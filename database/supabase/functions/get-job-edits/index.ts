import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  console.log("📥 Get Job Edits: Request received", {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.get("authorization"),
  });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    if (!token) {
      console.error("❌ Get Job Edits: No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser || !authUser.email) {
      console.error(
        "❌ Get Job Edits: User not found after token verification",
      );
      return errorResponse("User not found", 401);
    }

    const userEmail = authUser.email;
    console.log("✅ Get Job Edits: Token verified", {
      userId: authUser.id,
      email: userEmail,
    });

    // Get organization_id from organization_user table
    const { data: orgUser, error: orgUserError } = await supabaseAdmin
      .from("organization_user")
      .select("organization_id, role")
      .eq("email", userEmail)
      .maybeSingle();

    if (orgUserError) {
      console.error("❌ Get Job Edits: Error fetching organization user", {
        error: orgUserError.message,
      });
      throw orgUserError;
    }

    if (!orgUser) {
      console.error("❌ Get Job Edits: Organization user not found", {
        email: userEmail,
      });
      return errorResponse("Organization user not found", 404);
    }

    const organizationId = orgUser.organization_id;
    console.log("✅ Get Job Edits: Organization user found", {
      organizationId,
      role: orgUser.role,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("📦 Get Job Edits: Request body parsed", {
        hasJobId: !!body.job_id,
      });
    } catch (parseError) {
      console.error("❌ Get Job Edits: Failed to parse request body", {
        error: parseError instanceof Error
          ? parseError.message
          : String(parseError),
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
      console.error("❌ Get Job Edits: Error fetching job", {
        error: jobError.message,
      });
      throw jobError;
    }

    if (!job) {
      console.error("❌ Get Job Edits: Job not found or access denied", {
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
      console.warn(
        "⚠️ Get Job Edits: Error fetching edit history (returning empty array)",
        {
          error: editsError.message,
          code: editsError.code,
          hint: editsError.hint,
        },
      );

      // Return empty array instead of failing
      return jsonResponse({
        success: true,
        edits: [],
      });
    }

    console.log("✅ Get Job Edits: Edit history fetched successfully", {
      jobId: job_id,
      editCount: edits?.length || 0,
    });

    return jsonResponse({
      success: true,
      edits: edits || [],
    });
  } catch (error) {
    console.error("❌ Get Job Edits: Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

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
