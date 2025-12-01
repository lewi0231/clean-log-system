import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  console.log("📥 Create Job: Request received", {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.get("authorization"),
  });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    console.log("🔐 Create Job: Authentication check", {
      hasToken: !!token,
      tokenLength: token?.length || 0,
    });

    if (!token) {
      console.error("❌ Create Job: No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser) {
      console.error("❌ Create Job: User not found after token verification");
      return errorResponse("User not found", 401);
    }

    const authUserId = authUser.id;
    console.log("✅ Create Job: Token verified", {
      userId: authUserId,
      email: authUser.email,
    });

    // Get organization_id from worker table
    console.log("👷 Create Job: Fetching worker by auth_user_id", {
      authUserId,
    });
    const { data: worker, error: workerError } = await supabaseAdmin
      .from("worker")
      .select("organization_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (workerError) {
      console.error("❌ Create Job: Error fetching worker", {
        error: workerError.message,
        code: workerError.code,
        details: workerError.details,
      });
      throw workerError;
    }

    if (!worker) {
      console.error("❌ Create Job: Worker not found", {
        authUserId,
      });
      return errorResponse("Worker not found", 404);
    }

    const organizationId = worker.organization_id;
    console.log("✅ Create Job: Worker found", {
      organizationId,
    });

    // Fetch organization settings to check if predefined locations are required
    console.log("🏢 Create Job: Fetching organization settings", {
      organizationId,
    });
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organization")
      .select("use_predefined_locations")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error("❌ Create Job: Error fetching organization settings", {
        error: orgError.message,
        code: orgError.code,
        details: orgError.details,
      });
      throw orgError;
    }

    const usePredefinedLocations =
      organization?.use_predefined_locations ?? true;
    console.log("✅ Create Job: Organization settings fetched", {
      usePredefinedLocations,
    });

    // Parse request body
    console.log("📦 Create Job: Parsing request body");
    let body;
    try {
      body = await req.json();
      console.log("📦 Create Job: Request body parsed", {
        hasSubmissionData: !!body.submissionData,
        submissionDataKeys: body.submissionData
          ? Object.keys(body.submissionData)
          : [],
        hasColleagueIds: !!body.submissionData?.colleague_ids,
        colleagueIdsCount: Array.isArray(body.submissionData?.colleague_ids)
          ? body.submissionData.colleague_ids.length
          : 0,
        hasLocationId: !!body.submissionData?.location_id,
      });
    } catch (parseError) {
      console.error("❌ Create Job: Failed to parse request body", {
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
      });
      return errorResponse("Invalid request body", 400);
    }

    const { submissionData } = body;

    if (!submissionData || typeof submissionData !== "object") {
      console.error("❌ Create Job: Invalid submissionData", {
        hasSubmissionData: !!submissionData,
        type: typeof submissionData,
      });
      return errorResponse("submissionData is required", 400);
    }

    // Extract colleague_ids and location_id from submissionData
    const colleagueIds: string[] | undefined = submissionData.colleague_ids;
    const locationId: string | undefined = submissionData.location_id;

    console.log("📋 Create Job: Extracted data", {
      colleagueIdsCount: Array.isArray(colleagueIds) ? colleagueIds.length : 0,
      colleagueIds,
      locationId,
      fieldCount: Object.keys(submissionData).length,
    });

    // Remove colleague_ids and location_id from submission_data
    // These are stored separately in dedicated columns/tables
    const {
      colleague_ids: _colleague_ids,
      location_id: _location_id,
      ...fieldData
    } = submissionData;
    const submissionDataJsonb =
      Object.keys(fieldData).length > 0 ? fieldData : null;

    console.log("📋 Create Job: Processed submission data", {
      submissionDataKeys: Object.keys(fieldData),
      submissionDataJsonbSize: submissionDataJsonb
        ? JSON.stringify(submissionDataJsonb).length
        : 0,
    });

    // Normalize location_id (handle empty strings)
    const normalizedLocationId =
      locationId && locationId.trim() !== "" ? locationId : null;

    console.log("📍 Create Job: Location normalization", {
      originalLocationId: locationId,
      normalizedLocationId,
      usePredefinedLocations,
    });

    // Check if location_id is required based on organization settings
    if (usePredefinedLocations && !normalizedLocationId) {
      console.error("❌ Create Job: Location ID is required", {
        usePredefinedLocations,
        hasLocationId: !!normalizedLocationId,
      });
      return errorResponse(
        "Location ID is required when predefined locations are enabled",
        400
      );
    }

    // Validate location_id if provided (or required)
    if (normalizedLocationId) {
      console.log("📍 Create Job: Validating location", {
        locationId: normalizedLocationId,
        organizationId,
      });
      const { data: location, error: locationError } = await supabaseAdmin
        .from("location")
        .select("id, organization_id")
        .eq("id", normalizedLocationId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (locationError) {
        console.error("❌ Create Job: Error validating location", {
          error: locationError.message,
          code: locationError.code,
          details: locationError.details,
        });
        throw locationError;
      }

      if (!location) {
        console.error("❌ Create Job: Location not found", {
          locationId: normalizedLocationId,
          organizationId,
        });
        return errorResponse(
          "Location not found or does not belong to your organization",
          400
        );
      }
      console.log("✅ Create Job: Location validated", {
        locationId: location.id,
      });
    }

    // Validate colleague_ids if provided
    if (
      colleagueIds &&
      Array.isArray(colleagueIds) &&
      colleagueIds.length > 0
    ) {
      console.log("👥 Create Job: Validating colleagues", {
        colleagueIds,
        organizationId,
      });
      const { data: colleagues, error: colleaguesError } = await supabaseAdmin
        .from("worker")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", colleagueIds);

      if (colleaguesError) {
        console.error("❌ Create Job: Error validating colleagues", {
          error: colleaguesError.message,
          code: colleaguesError.code,
          details: colleaguesError.details,
        });
        throw colleaguesError;
      }

      // Check if all colleague_ids were found and belong to the organization
      if (!colleagues || colleagues.length !== colleagueIds.length) {
        console.error("❌ Create Job: Not all colleagues found", {
          requestedCount: colleagueIds.length,
          foundCount: colleagues?.length || 0,
          requestedIds: colleagueIds,
          foundIds: colleagues?.map((c) => c.id) || [],
        });
        return errorResponse(
          "One or more colleagues not found or do not belong to your organization",
          400
        );
      }
      console.log("✅ Create Job: All colleagues validated", {
        count: colleagues.length,
      });
    }

    // Create the job
    const jobInsertData = {
      organization_id: organizationId,
      location_id: normalizedLocationId,
      submission_data: submissionDataJsonb,
      completed_at: new Date().toISOString(),
    };
    console.log("💾 Create Job: Inserting job", {
      organizationId,
      locationId: normalizedLocationId,
      hasSubmissionData: !!submissionDataJsonb,
      completedAt: jobInsertData.completed_at,
    });

    const { data: job, error: jobError } = await supabaseAdmin
      .from("job")
      .insert(jobInsertData)
      .select()
      .single();

    if (jobError) {
      console.error("❌ Create Job: Error creating job", {
        error: jobError.message,
        code: jobError.code,
        details: jobError.details,
        hint: jobError.hint,
      });
      throw jobError;
    }

    console.log("✅ Create Job: Job created successfully", {
      jobId: job.id,
      organizationId: job.organization_id,
    });

    // Create job_worker entries if colleague_ids provided
    if (
      colleagueIds &&
      Array.isArray(colleagueIds) &&
      colleagueIds.length > 0
    ) {
      const jobWorkerEntries = colleagueIds.map((workerId) => ({
        job_id: job.id,
        worker_id: workerId,
      }));

      console.log("👥 Create Job: Creating job_worker entries", {
        jobId: job.id,
        entriesCount: jobWorkerEntries.length,
        entries: jobWorkerEntries,
      });

      const { error: jobWorkerError } = await supabaseAdmin
        .from("job_worker")
        .insert(jobWorkerEntries);

      if (jobWorkerError) {
        console.error("❌ Create Job: Error creating job_worker entries", {
          error: jobWorkerError.message,
          code: jobWorkerError.code,
          details: jobWorkerError.details,
          hint: jobWorkerError.hint,
        });
        throw jobWorkerError;
      }
      console.log("✅ Create Job: Job_worker entries created successfully");
    }

    console.log("✅ Create Job: Request completed successfully", {
      jobId: job.id,
      status: 201,
    });

    return jsonResponse(
      {
        success: true,
        job: {
          id: job.id,
          organization_id: job.organization_id,
          location_id: job.location_id,
          completed_at: job.completed_at,
          created_at: job.created_at,
        },
      },
      201
    );
  } catch (error) {
    const errorLog: Record<string, unknown> = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    };

    // Log additional properties if available
    if (error instanceof Error) {
      if ("code" in error) {
        errorLog.code = (error as { code?: unknown }).code;
      }
      if ("details" in error) {
        errorLog.details = (error as { details?: unknown }).details;
      }
    }

    console.error("❌ Create Job: Unhandled error", errorLog);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to create job";

    // Determine appropriate status code
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

    console.error("❌ Create Job: Returning error response", {
      statusCode,
      errorMessage,
    });

    return errorResponse(errorMessage, statusCode);
  }
});
