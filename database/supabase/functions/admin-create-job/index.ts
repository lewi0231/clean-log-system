import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import { enqueueOrSendFeedback } from "../_utils/feedback-send.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { withJobWorkerTimes } from "../_utils/job-worker-times.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "admin-create-job" });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    if (!token) {
      logger.warn("No authentication token provided for admin job creation");
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
    logger.debug("Token verified for admin job creation", {
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
      logger.warn("User is not an admin attempting to create job", {
        email: userEmail,
        role: orgUser.role,
      });
      return errorResponse("Only admin users can create jobs", 403);
    }

    const organizationId = orgUser.organization_id;
    logger.debug("Admin user verified for job creation", {
      organizationId,
      role: orgUser.role,
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

    const usePredefinedLocations = organization?.use_predefined_locations ?? true;
    logger.debug("Organization settings fetched", {
      usePredefinedLocations,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
      logger.debug("Request body parsed for admin job creation", {
        hasOrganizationId: !!body.organization_id,
        hasSubmissionData: !!body.submission_data,
        hasWorkerIds: !!body.worker_ids,
        hasLocationId: !!body.location_id,
        hasCompletedAt: !!body.completed_at,
      });
    } catch (parseError) {
      logger.error("Failed to parse request body", parseError);
      return errorResponse("Invalid request body", 400);
    }

    // Validate organization_id matches authenticated user's organization
    if (body.organization_id !== organizationId) {
      logger.warn("Organization ID mismatch", {
        provided: body.organization_id,
        expected: organizationId,
      });
      return errorResponse("Organization ID does not match your organization", 403);
    }

    // Validate submission_data
    const { submission_data, worker_ids, location_id, completed_at } = body;

    if (!submission_data || typeof submission_data !== "object") {
      logger.warn("Invalid submission_data for admin job creation", {
        hasSubmissionData: !!submission_data,
        type: typeof submission_data,
      });
      return errorResponse("submission_data is required", 400);
    }

    // Normalize location_id (handle empty strings)
    const normalizedLocationId =
      location_id && typeof location_id === "string" && location_id.trim() !== ""
        ? location_id.trim()
        : null;

    logger.debug("Location normalization for admin job creation", {
      originalLocationId: location_id,
      normalizedLocationId,
      usePredefinedLocations,
    });

    // Check if location_id is required based on organization settings
    if (usePredefinedLocations && !normalizedLocationId) {
      logger.warn("Location ID is required but not provided", {
        usePredefinedLocations,
        hasLocationId: !!normalizedLocationId,
      });
      return errorResponse("Location ID is required when predefined locations are enabled", 400);
    }

    // Validate location_id if provided (or required)
    if (normalizedLocationId) {
      logger.debug("Validating location for admin job creation", {
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
        logger.error("Error validating location", locationError, {
          locationId: normalizedLocationId,
          organizationId,
        });
        throw locationError;
      }

      if (!location) {
        logger.warn("Location not found for admin job creation", {
          locationId: normalizedLocationId,
          organizationId,
        });
        return errorResponse("Location not found or does not belong to your organization", 400);
      }
      logger.debug("Location validated", {
        locationId: location.id,
      });
    }

    // Validate worker_ids if provided
    const normalizedWorkerIds =
      Array.isArray(worker_ids) && worker_ids.length > 0
        ? worker_ids.filter((id: unknown) => typeof id === "string" && id.trim() !== "")
        : [];

    if (normalizedWorkerIds.length > 0) {
      logger.debug("Validating workers for admin job creation", {
        workerIds: normalizedWorkerIds,
        organizationId,
      });
      const { data: workers, error: workersError } = await supabaseAdmin
        .from("worker")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", normalizedWorkerIds);

      if (workersError) {
        logger.error("Error validating workers", workersError, {
          workerIds: normalizedWorkerIds,
          organizationId,
        });
        throw workersError;
      }

      // Check if all worker_ids were found and belong to the organization
      if (!workers || workers.length !== normalizedWorkerIds.length) {
        logger.warn("Not all workers found for admin job creation", {
          requestedCount: normalizedWorkerIds.length,
          foundCount: workers?.length || 0,
          requestedIds: normalizedWorkerIds,
          foundIds: workers?.map((w) => w.id) || [],
        });
        return errorResponse(
          "One or more workers not found or do not belong to your organization",
          400
        );
      }
      logger.debug("All workers validated", {
        count: workers.length,
      });
    }

    // Normalize completed_at (default to now if not provided)
    const normalizedCompletedAt =
      completed_at && typeof completed_at === "string" ? completed_at : new Date().toISOString();

    // Determine whether this is test data (server-derived, not a trusted client flag)
    const isTestJob =
      typeof submission_data === "object" &&
      submission_data !== null &&
      "_is_test" in (submission_data as Record<string, unknown>) &&
      (submission_data as Record<string, unknown>)._is_test === true;

    // Create the job
    const jobInsertData = {
      organization_id: organizationId,
      location_id: normalizedLocationId,
      submission_data: submission_data,
      completed_at: normalizedCompletedAt,
      is_test: isTestJob,
      submitted_by_email: userEmail, // Track who created the job
    };
    logger.debug("Inserting job for admin", {
      organizationId,
      locationId: normalizedLocationId,
      hasSubmissionData: !!submission_data,
      completedAt: jobInsertData.completed_at,
      workerIdsCount: normalizedWorkerIds.length,
    });

    const { data: job, error: jobError } = await supabaseAdmin
      .from("job")
      .insert(jobInsertData)
      .select()
      .single();

    if (jobError) {
      logger.error("Error creating job", jobError, {
        organizationId,
        locationId: normalizedLocationId,
        details: jobError.details,
        hint: jobError.hint,
      });
      throw jobError;
    }

    logger.info("Job created successfully by admin", {
      jobId: job.id,
      organizationId: job.organization_id,
    });

    // Notify admins that a job was created (non-blocking)
    const notificationResult = await createNotification(supabaseAdmin, {
      organization_id: job.organization_id,
      type: "job_completed",
      title: "Job submitted",
      message: "A new job was created.",
      related_entity_type: "job",
      related_entity_id: job.id,
    });
    if (!notificationResult.success) {
      logger.warn("Failed to create job notification", {
        error: notificationResult.error,
        jobId: job.id,
      });
    } else {
      logger.debug("Job notification created", {
        jobId: job.id,
        notificationCount: notificationResult.notificationCount,
      });
    }

    // Create job_worker entries if worker_ids provided
    if (normalizedWorkerIds.length > 0) {
      const submissionForTimes =
        submission_data && typeof submission_data === "object"
          ? (submission_data as Record<string, unknown>)
          : null;
      const jobWorkerEntries = withJobWorkerTimes(
        normalizedWorkerIds.map((workerId: string) => ({
          job_id: job.id,
          worker_id: workerId,
        })),
        submissionForTimes
      );

      logger.debug("Creating job_worker entries", {
        jobId: job.id,
        entriesCount: jobWorkerEntries.length,
        timedCount: jobWorkerEntries.filter((e) => e.start_time && e.end_time).length,
      });

      const { error: jobWorkerError } = await supabaseAdmin
        .from("job_worker")
        .insert(jobWorkerEntries);

      if (jobWorkerError) {
        logger.error("Error creating job_worker entries", jobWorkerError, {
          jobId: job.id,
          organizationId,
          entriesCount: jobWorkerEntries.length,
        });
        throw jobWorkerError;
      }
      logger.debug("Job_worker entries created successfully", {
        jobId: job.id,
        count: jobWorkerEntries.length,
      });
    }

    // Feedback email: shared helper (never fail job creation — PRESERVE-1)
    try {
      const feedbackResult = await enqueueOrSendFeedback(supabaseAdmin, job.id, {
        path: "auto",
      });
      if (feedbackResult.sent) {
        logger.info("Feedback email sent successfully", {
          jobId: job.id,
          emailId: feedbackResult.emailId,
        });
      } else if (feedbackResult.queued) {
        logger.info("Feedback email queued", {
          jobId: job.id,
          outboxId: feedbackResult.outboxId,
        });
      } else if (feedbackResult.skipped) {
        logger.debug("Feedback email skipped", {
          jobId: job.id,
          reason: feedbackResult.reason,
        });
      } else if (!feedbackResult.ok) {
        logger.error("Feedback email enqueue/send failed", feedbackResult.reason, {
          jobId: job.id,
        });
      }
    } catch (feedbackError) {
      logger.error("Error in feedback email sending process", feedbackError, {
        jobId: job.id,
        organizationId,
      });
    }

    logger.info("Admin job creation completed successfully", {
      jobId: job.id,
      organizationId,
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
    logger.error("Admin create job error", error);

    return errorResponse(
      extractErrorMessage(error, "Failed to create job"),
      getErrorStatusCode(error)
    );
  }
});
