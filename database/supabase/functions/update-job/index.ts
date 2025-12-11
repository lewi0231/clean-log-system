import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  console.log("📥 Update Job: Request received", {
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
      console.error("❌ Update Job: No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser || !authUser.email) {
      console.error(
        "❌ Update Job: User not found after token verification",
      );
      return errorResponse("User not found", 401);
    }

    const userEmail = authUser.email;
    console.log("✅ Update Job: Token verified", {
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
      console.error("❌ Update Job: Error fetching organization user", {
        error: orgUserError.message,
      });
      throw orgUserError;
    }

    if (!orgUser) {
      console.error("❌ Update Job: Organization user not found", {
        email: userEmail,
      });
      return errorResponse("Organization user not found", 404);
    }

    // Check if user is admin
    if (orgUser.role !== "admin") {
      console.error("❌ Update Job: User is not an admin", {
        email: userEmail,
        role: orgUser.role,
      });
      return errorResponse("Only admin users can update jobs", 403);
    }

    const organizationId = orgUser.organization_id;
    console.log("✅ Update Job: Admin user found", {
      organizationId,
      role: orgUser.role,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("📦 Update Job: Request body parsed", {
        hasJobId: !!body.id,
        hasSubmissionData: !!body.submission_data,
        hasWorkerIds: !!body.worker_ids,
        hasLocationId: !!body.location_id,
        hasCompletedAt: !!body.completed_at,
      });
    } catch (parseError) {
      console.error("❌ Update Job: Failed to parse request body", {
        error: parseError instanceof Error
          ? parseError.message
          : String(parseError),
      });
      return errorResponse("Invalid request body", 400);
    }

    // Validate required fields
    const validation = validateRequiredFields(body, ["id"]);
    if (!validation.valid) {
      return errorResponse("Job ID is required", 400);
    }

    const {
      id: jobId,
      submission_data,
      worker_ids,
      location_id,
      completed_at,
    } = body;

    // Verify job exists and belongs to organization
    // Fetch full job data for audit trail
    const { data: existingJob, error: jobError } = await supabaseAdmin
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        submission_data,
        completed_at,
        created_at
      `,
      )
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .single();

    if (jobError || !existingJob) {
      console.error("❌ Update Job: Job not found or access denied", {
        jobId,
        organizationId,
        error: jobError?.message,
      });
      return errorResponse(
        "Job not found or does not belong to your organization",
        404,
      );
    }

    console.log("✅ Update Job: Job found", {
      jobId: existingJob.id,
    });

    // Fetch organization settings to check if predefined locations are required
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organization")
      .select("use_predefined_locations")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error(
        "❌ Update Job: Error fetching organization settings",
        {
          error: orgError.message,
        },
      );
      throw orgError;
    }

    const usePredefinedLocations = organization?.use_predefined_locations ??
      true;

    // Build update object with only provided fields
    const updateData: {
      submission_data?: Record<string, unknown>;
      location_id?: string | null;
      completed_at?: string;
    } = {};

    if (submission_data !== undefined) {
      if (!submission_data || typeof submission_data !== "object") {
        return errorResponse("submission_data must be an object", 400);
      }
      updateData.submission_data = submission_data;
    }

    // Normalize location_id (handle empty strings)
    if (location_id !== undefined) {
      const normalizedLocationId =
        location_id && typeof location_id === "string" &&
          location_id.trim() !== ""
          ? location_id.trim()
          : null;

      // Check if location_id is required based on organization settings
      if (usePredefinedLocations && !normalizedLocationId) {
        return errorResponse(
          "Location ID is required when predefined locations are enabled",
          400,
        );
      }

      // Validate location_id if provided (or required)
      if (normalizedLocationId) {
        const { data: location, error: locationError } = await supabaseAdmin
          .from("location")
          .select("id, organization_id")
          .eq("id", normalizedLocationId)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (locationError) {
          console.error("❌ Update Job: Error validating location", {
            error: locationError.message,
          });
          throw locationError;
        }

        if (!location) {
          return errorResponse(
            "Location not found or does not belong to your organization",
            400,
          );
        }
      }

      updateData.location_id = normalizedLocationId;
    }

    if (completed_at !== undefined) {
      if (typeof completed_at !== "string") {
        return errorResponse("completed_at must be a string", 400);
      }
      updateData.completed_at = completed_at;
    }

    // Update the job if there are fields to update
    if (Object.keys(updateData).length > 0) {
      console.log("💾 Update Job: Updating job", {
        jobId,
        updateFields: Object.keys(updateData),
      });

      const { data: updatedJob, error: updateError } = await supabaseAdmin
        .from("job")
        .update(updateData)
        .eq("id", jobId)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Update Job: Error updating job", {
          error: updateError.message,
          code: updateError.code,
        });
        throw updateError;
      }

      console.log("✅ Update Job: Job updated successfully", {
        jobId: updatedJob.id,
      });
    }

    // Handle worker_ids update if provided
    if (worker_ids !== undefined) {
      const normalizedWorkerIds =
        Array.isArray(worker_ids) && worker_ids.length > 0
          ? worker_ids.filter((id: unknown) =>
            typeof id === "string" && id.trim() !== ""
          )
          : [];

      // Validate worker_ids if provided
      if (normalizedWorkerIds.length > 0) {
        const { data: workers, error: workersError } = await supabaseAdmin
          .from("worker")
          .select("id")
          .eq("organization_id", organizationId)
          .in("id", normalizedWorkerIds);

        if (workersError) {
          console.error("❌ Update Job: Error validating workers", {
            error: workersError.message,
          });
          throw workersError;
        }

        if (!workers || workers.length !== normalizedWorkerIds.length) {
          return errorResponse(
            "One or more workers not found or do not belong to your organization",
            400,
          );
        }
      }

      // Delete existing job_worker entries
      const { error: deleteError } = await supabaseAdmin
        .from("job_worker")
        .delete()
        .eq("job_id", jobId);

      if (deleteError) {
        console.error(
          "❌ Update Job: Error deleting existing job_worker entries",
          {
            error: deleteError.message,
          },
        );
        throw deleteError;
      }

      // Create new job_worker entries if worker_ids provided
      if (normalizedWorkerIds.length > 0) {
        const jobWorkerEntries = normalizedWorkerIds.map((
          workerId: string,
        ) => ({
          job_id: jobId,
          worker_id: workerId,
        }));

        const { error: jobWorkerError } = await supabaseAdmin
          .from("job_worker")
          .insert(jobWorkerEntries);

        if (jobWorkerError) {
          console.error(
            "❌ Update Job: Error creating job_worker entries",
            {
              error: jobWorkerError.message,
            },
          );
          throw jobWorkerError;
        }

        console.log(
          "✅ Update Job: Job_worker entries updated successfully",
          {
            count: normalizedWorkerIds.length,
          },
        );
      }
    }

    // Fetch updated job with relationships
    const { data: finalJob, error: fetchError } = await supabaseAdmin
      .from("job")
      .select(
        `
        id,
        organization_id,
        location_id,
        submission_data,
        completed_at,
        created_at,
        location:location_id (
          id,
          name,
          email,
          address,
          contact_person,
          phone
        )
      `,
      )
      .eq("id", jobId)
      .single();

    if (fetchError) {
      console.error("❌ Update Job: Error fetching updated job", {
        error: fetchError.message,
      });
      throw fetchError;
    }

    // Fetch workers for the job
    const { data: jobWorkers, error: workersFetchError } = await supabaseAdmin
      .from("job_worker")
      .select(
        `
        worker:worker_id (
          id,
          name,
          email,
          phone
        )
      `,
      )
      .eq("job_id", jobId);

    if (workersFetchError) {
      console.error("❌ Update Job: Error fetching workers", {
        error: workersFetchError.message,
      });
      throw workersFetchError;
    }

    // Format workers array
    const workers = (jobWorkers || []).map((jw: { worker: unknown }) => {
      const worker = Array.isArray(jw.worker) ? jw.worker[0] : jw.worker;
      return worker;
    }).filter(Boolean);

    // Log edit to audit trail if any changes were made
    const hasChanges = Object.keys(updateData).length > 0 ||
      worker_ids !== undefined;

    if (hasChanges && existingJob) {
      try {
        // Determine which fields changed
        const changedFields: string[] = [];

        if (updateData.submission_data !== undefined) {
          changedFields.push("submission_data");
        }
        if (updateData.location_id !== undefined) {
          changedFields.push("location_id");
        }
        if (updateData.completed_at !== undefined) {
          changedFields.push("completed_at");
        }
        if (worker_ids !== undefined) {
          changedFields.push("workers");
        }

        // Prepare old and new data snapshots
        const oldData = {
          location_id: existingJob.location_id,
          submission_data: existingJob.submission_data,
          completed_at: existingJob.completed_at,
        };

        const newData = {
          location_id: finalJob.location_id,
          submission_data: finalJob.submission_data,
          completed_at: finalJob.completed_at,
        };

        // Log to job_edits table
        const { error: auditError } = await supabaseAdmin
          .from("job_edits")
          .insert({
            job_id: jobId,
            edited_by_email: userEmail,
            edited_by_user_id: authUser.id,
            action: "UPDATE",
            old_data: oldData,
            new_data: newData,
            changed_fields: changedFields,
          });

        if (auditError) {
          // Log error but don't fail the update
          console.error("⚠️ Update Job: Failed to log audit trail", {
            error: auditError.message,
            jobId,
          });
        } else {
          console.log("✅ Update Job: Audit trail logged", {
            jobId,
            changedFields,
            editedBy: userEmail,
          });
        }
      } catch (auditErr) {
        // Log error but don't fail the update
        console.error("⚠️ Update Job: Error logging audit trail", {
          error: auditErr instanceof Error
            ? auditErr.message
            : String(auditErr),
        });
      }
    }

    console.log("✅ Update Job: Request completed successfully", {
      jobId: finalJob.id,
    });

    return jsonResponse({
      success: true,
      job: {
        ...finalJob,
        workers,
      },
    });
  } catch (error) {
    console.error("❌ Update Job: Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to update job";

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
      } else if (error.message.includes("does not match")) {
        statusCode = 403;
      }
    }

    return errorResponse(errorMessage, statusCode);
  }
});
