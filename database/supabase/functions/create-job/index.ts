import { createClient } from "@supabase/supabase-js";
import { serve } from "server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
} as const;

serve(async (req) => {
  console.log("📥 Create Job: Request received", {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.get("authorization"),
  });

  if (req.method === "OPTIONS") {
    console.log("📥 Create Job: OPTIONS request, returning OK");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token from headers
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    console.log("🔐 Create Job: Authentication check", {
      hasToken: !!token,
      tokenLength: token?.length || 0,
    });

    if (!token) {
      console.error("❌ Create Job: No authentication token provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify token and get user
    let authUserId: string | null = null;
    try {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      console.log("🔐 Create Job: Verifying token", {
        hasAnonKey: !!anonKey,
      });
      if (anonKey) {
        const supabaseAnon = createClient(
          Deno.env.get("SUPABASE_URL")!,
          anonKey
        );
        const {
          data: { user },
          error: userError,
        } = await supabaseAnon.auth.getUser(token);

        if (userError) {
          console.error("❌ Create Job: Token verification error", {
            error: userError.message,
            code: userError.status,
          });
        } else if (user) {
          authUserId = user.id;
          console.log("✅ Create Job: Token verified", {
            userId: authUserId,
            email: user.email,
          });
        } else {
          console.warn("⚠️ Create Job: Token verified but no user returned");
        }
      } else {
        console.warn("⚠️ Create Job: SUPABASE_ANON_KEY not available");
      }
    } catch (err) {
      console.error("❌ Create Job: Error verifying auth token", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!authUserId) {
      console.error("❌ Create Job: User not found after token verification");
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "Worker not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = worker.organization_id;
    console.log("✅ Create Job: Worker found", {
      organizationId,
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
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submissionData } = body;

    if (!submissionData || typeof submissionData !== "object") {
      console.error("❌ Create Job: Invalid submissionData", {
        hasSubmissionData: !!submissionData,
        type: typeof submissionData,
      });
      return new Response(
        JSON.stringify({ error: "submissionData is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
    });

    // Validate location_id if provided
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
        return new Response(
          JSON.stringify({
            error: "Location not found or does not belong to your organization",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
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
        return new Response(
          JSON.stringify({
            error:
              "One or more colleagues not found or do not belong to your organization",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
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

    return new Response(
      JSON.stringify({
        success: true,
        job: {
          id: job.id,
          organization_id: job.organization_id,
          location_id: job.location_id,
          completed_at: job.completed_at,
          created_at: job.created_at,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
