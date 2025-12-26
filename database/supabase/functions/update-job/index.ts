import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { autoGenerateInvoiceForJob } from "../_utils/auto-invoice.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req: Request) => {
  const logger = createLogger(req, { functionName: "update-job" });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    if (!token) {
      logger.warn("No authentication token provided for job update");
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
    logger.debug("Token verified for job update", {
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
      logger.error("Error fetching organization user", orgUserError, {
        user_email: userEmail,
      });
      throw orgUserError;
    }

    if (!orgUser) {
      logger.warn("Organization user not found", {
        email: userEmail,
      });
      return errorResponse("Organization user not found", 404);
    }

    // Check if user is admin
    if (orgUser.role !== "admin") {
      logger.warn("User is not an admin attempting to update job", {
        email: userEmail,
        role: orgUser.role,
      });
      return errorResponse("Only admin users can update jobs", 403);
    }

    const organizationId = orgUser.organization_id;
    logger.debug("Admin user verified for job update", {
      organizationId,
      role: orgUser.role,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
      logger.debug("Request body parsed for job update", {
        hasJobId: !!body.id,
        hasSubmissionData: !!body.submission_data,
        hasWorkerIds: !!body.worker_ids,
        hasLocationId: !!body.location_id,
        hasCompletedAt: !!body.completed_at,
      });
    } catch (parseError) {
      logger.error("Failed to parse request body", parseError);
      return errorResponse("Invalid request body", 400);
    }

    // Validate required fields
    const validation = validateRequiredFields(body, ["id"]);
    if (!validation.valid) {
      logger.warn("Missing required field for job update", {
        missingFields: validation.missingFields,
      });
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
      logger.warn("Job not found or access denied", {
        error: jobError,
        jobId,
        organizationId,
      });
      return errorResponse(
        "Job not found or does not belong to your organization",
        404,
      );
    }

    logger.debug("Job found for update", {
      jobId: existingJob.id,
    });

    // Fetch organization settings to check if predefined locations are required
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organization")
      .select("use_predefined_locations")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      logger.error("Error fetching organization settings", orgError, {
        organizationId,
      });
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
          logger.error("Error validating location", locationError, {
            location_id: normalizedLocationId,
            organizationId,
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
      logger.debug("Updating job", {
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
        logger.error("Error updating job", updateError, {
          jobId,
          organizationId,
          updateFields: Object.keys(updateData),
        });
        throw updateError;
      }

      logger.info("Job updated successfully", {
        jobId: updatedJob.id,
        organizationId,
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
          logger.error("Error validating workers", workersError, {
            jobId,
            organizationId,
            worker_count: normalizedWorkerIds.length,
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
        logger.error(
          "Error deleting existing job_worker entries",
          deleteError,
          {
            jobId,
            organizationId,
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
          logger.error("Error creating job_worker entries", jobWorkerError, {
            jobId,
            organizationId,
            worker_count: normalizedWorkerIds.length,
          });
          throw jobWorkerError;
        }

        logger.info("Job_worker entries updated successfully", {
          count: normalizedWorkerIds.length,
        });
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
      logger.error("Error fetching updated job", fetchError, {
        jobId,
        organizationId,
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
      logger.error("Error fetching workers", workersFetchError, {
        jobId,
        organizationId,
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
          logger.warn("Failed to log audit trail", {
            error: auditError,
            jobId,
            organizationId,
          });
        } else {
          logger.debug("Audit trail logged", {
            jobId,
            changedFields,
            editedBy: userEmail,
          });
        }
      } catch (auditErr) {
        // Log error but don't fail the update
        logger.warn("Error logging audit trail", {
          error: auditErr,
          jobId,
          organizationId,
        });
      }
    }

    // Auto-generate invoice if job was just completed and setting is enabled
    // Uses shared utility to avoid code duplication with create-job
    const wasJustCompleted = updateData.completed_at !== undefined &&
      (!existingJob.completed_at ||
        existingJob.completed_at !== updateData.completed_at);

    if (wasJustCompleted) {
      const autoInvoiceResult = await autoGenerateInvoiceForJob({
        jobId: finalJob.id,
        organizationId,
        locationId: finalJob.location_id,
        supabaseAdmin,
        logger,
      });

      if (autoInvoiceResult.skipped) {
        logger.debug("Auto-invoice generation skipped", {
          jobId: finalJob.id,
          reason: autoInvoiceResult.skipReason,
        });
      } else if (!autoInvoiceResult.success) {
        // Log but don't fail job update
        logger.warn("Auto-invoice generation failed", {
          jobId: finalJob.id,
          error: autoInvoiceResult.error,
        });
      }
    }

    logger.info("Job update completed successfully", {
      jobId: finalJob.id,
      organizationId,
      changedFields: hasChanges ? Object.keys(updateData) : [],
    });

    return jsonResponse({
      success: true,
      job: {
        ...finalJob,
        workers,
      },
    });
  } catch (error) {
    logger.error("Update job error", error);

    return errorResponse(
      extractErrorMessage(error, "Failed to update job"),
      getErrorStatusCode(error),
    );
  }
});
