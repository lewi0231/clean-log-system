import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
} from "../_utils/auth.ts";
import { autoGenerateInvoiceForJob } from "../_utils/auto-invoice.ts";
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
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "create-job" });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    if (!token) {
      logger.warn("No authentication token provided for job creation");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser) {
      logger.warn("User not found after token verification");
      return errorResponse("User not found", 401);
    }

    const authUserId = authUser.id;
    const userEmail = authUser.email ?? null;
    logger.debug("Token verified for job creation", {
      userId: authUserId,
      email: userEmail,
    });

    // Get organization_id - try admin first, then worker
    let organizationId: string | null = null;

    // Try to get organization_id from admin (organization_user table)
    if (userEmail) {
      organizationId = await getOrganizationIdFromAdmin(
        supabaseAdmin,
        userEmail,
      );
      if (organizationId) {
        logger.debug("Organization ID found from admin user", {
          organizationId,
          email: userEmail,
        });
      }
    }

    // Fallback: try to get organization_id from worker table
    if (!organizationId) {
      organizationId = await getOrganizationIdFromWorker(
        supabaseAdmin,
        authUserId,
      );
      if (organizationId) {
        logger.debug("Organization ID found from worker", {
          organizationId,
          authUserId,
        });
      }
    }

    if (!organizationId) {
      logger.warn("Organization ID not found for user", {
        authUserId,
        email: userEmail,
      });
      return errorResponse(
        "User is not associated with any organization. Please contact your administrator.",
        404,
      );
    }

    // Fetch organization and organization_settings to check configuration
    logger.debug("Fetching organization settings", {
      organizationId,
    });
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organization")
      .select("use_predefined_locations, colleague_confirmation_timeout_hours")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      logger.error("Error fetching organization settings", orgError, {
        organizationId,
      });
      throw orgError;
    }

    // Fetch organization_settings for edit window minutes
    const { data: orgSettings } = await supabaseAdmin
      .from("organization_settings")
      .select("edit_window_minutes")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const usePredefinedLocations = organization?.use_predefined_locations ??
      true;
    // Default to 24 hours if not set
    const confirmationTimeoutHours = organization?.colleague_confirmation_timeout_hours ?? 24;
    // Default to 180 minutes (3 hours) if not set
    const editWindowMinutes = orgSettings?.edit_window_minutes ?? 180;
    logger.debug("Organization settings fetched", {
      usePredefinedLocations,
      confirmationTimeoutHours,
      editWindowMinutes,
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
      logger.debug("Request body parsed for job creation", {
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
      logger.error("Failed to parse request body", parseError);
      return errorResponse("Invalid request body", 400);
    }

    const { submissionData } = body;

    if (!submissionData || typeof submissionData !== "object") {
      logger.warn("Invalid submissionData for job creation", {
        hasSubmissionData: !!submissionData,
        type: typeof submissionData,
      });
      return errorResponse("submissionData is required", 400);
    }

    // Extract colleague_ids and location_id from submissionData
    const colleagueIds: string[] | undefined = submissionData.colleague_ids;
    const locationId: string | undefined = submissionData.location_id;

    logger.debug("Extracted data from submission", {
      colleagueIdsCount: Array.isArray(colleagueIds) ? colleagueIds.length : 0,
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
    const submissionDataJsonb = Object.keys(fieldData).length > 0
      ? fieldData
      : null;

    logger.debug("Processed submission data", {
      submissionDataKeys: Object.keys(fieldData),
      submissionDataJsonbSize: submissionDataJsonb
        ? JSON.stringify(submissionDataJsonb).length
        : 0,
    });

    // Normalize location_id (handle empty strings)
    const normalizedLocationId = locationId && locationId.trim() !== ""
      ? locationId
      : null;

    logger.debug("Location normalization", {
      originalLocationId: locationId,
      normalizedLocationId,
      usePredefinedLocations,
    });

    // Check if location_id is required based on organization settings
    if (usePredefinedLocations && !normalizedLocationId) {
      logger.warn("Location ID is required but not provided", {
        usePredefinedLocations,
        hasLocationId: !!normalizedLocationId,
      });
      return errorResponse(
        "Location ID is required when predefined locations are enabled",
        400,
      );
    }

    // Validate location_id if provided (or required)
    if (normalizedLocationId) {
      logger.debug("Validating location", {
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
        logger.warn("Location not found", {
          locationId: normalizedLocationId,
          organizationId,
        });
        return errorResponse(
          "Location not found or does not belong to your organization",
          400,
        );
      }
      logger.debug("Location validated", {
        locationId: location.id,
      });
    }

    // Validate colleague_ids if provided
    if (
      colleagueIds &&
      Array.isArray(colleagueIds) &&
      colleagueIds.length > 0
    ) {
      logger.debug("Validating colleagues", {
        colleagueIds,
        organizationId,
      });
      const { data: colleagues, error: colleaguesError } = await supabaseAdmin
        .from("worker")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", colleagueIds);

      if (colleaguesError) {
        logger.error("Error validating colleagues", colleaguesError, {
          colleagueIds,
          organizationId,
        });
        throw colleaguesError;
      }

      // Check if all colleague_ids were found and belong to the organization
      if (!colleagues || colleagues.length !== colleagueIds.length) {
        logger.warn("Not all colleagues found", {
          requestedCount: colleagueIds.length,
          foundCount: colleagues?.length || 0,
          requestedIds: colleagueIds,
          foundIds: colleagues?.map((c) => c.id) || [],
        });
        return errorResponse(
          "One or more colleagues not found or do not belong to your organization",
          400,
        );
      }
      logger.debug("All colleagues validated", {
        count: colleagues.length,
      });
    }

    // Get submitting worker ID from auth user metadata (if they are a worker)
    const submittingWorkerId = authUser.user_metadata?.worker_id ?? null;
    
    // Determine if this job needs colleague confirmation
    // Job is pending if: submitted by a worker AND has colleagues (other than themselves)
    const hasColleagues = colleagueIds && Array.isArray(colleagueIds) && colleagueIds.length > 0;
    const hasOtherColleagues = hasColleagues && (
      // If submitter is not a worker, all colleagues are "other" colleagues
      !submittingWorkerId ||
      // If submitter is a worker, check if there are colleagues other than themselves
      colleagueIds.some((id) => id !== submittingWorkerId)
    );
    const needsConfirmation = submittingWorkerId && hasOtherColleagues;
    
    // Calculate timestamps for confirmation workflow
    const now = new Date();
    const autoApproveAt = needsConfirmation
      ? new Date(now.getTime() + confirmationTimeoutHours * 60 * 60 * 1000).toISOString()
      : null;
    // Edit window uses organization setting (default 180 minutes = 3 hours)
    const editWindowExpiresAt = needsConfirmation
      ? new Date(now.getTime() + editWindowMinutes * 60 * 1000).toISOString()
      : null;

    // Create the job (submitted_by_email = whoever submitted: admin via dashboard or worker via mobile)
    const jobInsertData = {
      organization_id: organizationId,
      location_id: normalizedLocationId,
      submission_data: submissionDataJsonb,
      completed_at: now.toISOString(),
      submitted_by_email: userEmail,
      // Colleague confirmation workflow fields
      approval_status: needsConfirmation ? "pending" : "approved",
      submitted_by_worker_id: submittingWorkerId,
      auto_approve_at: autoApproveAt,
      edit_window_expires_at: editWindowExpiresAt,
    };
    logger.debug("Inserting job", {
      organizationId,
      locationId: normalizedLocationId,
      hasSubmissionData: !!submissionDataJsonb,
      completedAt: jobInsertData.completed_at,
      approvalStatus: jobInsertData.approval_status,
      needsConfirmation,
      autoApproveAt,
      editWindowExpiresAt,
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
      });
      throw jobError;
    }

    logger.info("Job created successfully", {
      jobId: job.id,
      organizationId: job.organization_id,
    });

    // Notify admins that a worker submitted a job (non-blocking)
    const notificationResult = await createNotification(supabaseAdmin, {
      organization_id: job.organization_id,
      type: "job_completed",
      title: "Job submitted",
      message: "A worker has submitted a new job.",
      related_entity_type: "job",
      related_entity_id: job.id,
    });
    if (!notificationResult.success) {
      logger.warn("Failed to create job submission notification", {
        error: notificationResult.error,
        jobId: job.id,
      });
    }

    // Create job_worker entries if colleague_ids provided
    // Track colleagues that need confirmation notifications
    const colleaguesNeedingNotification: string[] = [];
    
    if (
      colleagueIds &&
      Array.isArray(colleagueIds) &&
      colleagueIds.length > 0
    ) {
      const confirmedAt = now.toISOString();
      const jobWorkerEntries = colleagueIds.map((workerId) => {
        // The submitting worker is auto-confirmed
        const isSubmitter = workerId === submittingWorkerId;
        // If job doesn't need confirmation, all workers are confirmed
        const isConfirmed = !needsConfirmation || isSubmitter;
        
        if (!isConfirmed) {
          colleaguesNeedingNotification.push(workerId);
        }
        
        return {
          job_id: job.id,
          worker_id: workerId,
          // Colleague confirmation workflow fields
          confirmation_status: isConfirmed ? "confirmed" : "pending",
          confirmed_at: isConfirmed ? confirmedAt : null,
        };
      });

      logger.debug("Creating job_worker entries", {
        jobId: job.id,
        entriesCount: jobWorkerEntries.length,
        confirmedCount: jobWorkerEntries.filter((e) => e.confirmation_status === "confirmed").length,
        pendingCount: jobWorkerEntries.filter((e) => e.confirmation_status === "pending").length,
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
    
    // Send confirmation request notifications to colleagues (non-blocking)
    if (colleaguesNeedingNotification.length > 0) {
      try {
        // Get location name for notification
        let locationName = "a job site";
        if (normalizedLocationId) {
          const { data: locationData } = await supabaseAdmin
            .from("location")
            .select("name")
            .eq("id", normalizedLocationId)
            .single();
          if (locationData?.name) {
            locationName = locationData.name;
          }
        }
        
        // Format the auto-approve time for notification
        const autoApproveDate = autoApproveAt ? new Date(autoApproveAt) : null;
        const timeUntilAutoApprove = autoApproveDate
          ? `${confirmationTimeoutHours} hours`
          : "soon";
        
        logger.debug("Sending confirmation notifications to colleagues", {
          jobId: job.id,
          colleagueCount: colleaguesNeedingNotification.length,
          locationName,
          timeUntilAutoApprove,
        });
        
        // Create notification for all admins about the pending job
        // Note: Worker notifications would typically be push notifications
        // handled by a separate mobile notification system
        const notificationResult = await createNotification(supabaseAdmin, {
          organization_id: job.organization_id,
          type: "job_confirmation_requested",
          title: "Job Pending Confirmation",
          message: `A job at ${locationName} requires colleague confirmation. It will auto-approve in ${timeUntilAutoApprove}.`,
          related_entity_type: "job",
          related_entity_id: job.id,
        });
        
        if (!notificationResult.success) {
          logger.warn("Failed to create confirmation request notification", {
            error: notificationResult.error,
            jobId: job.id,
          });
        }
      } catch (notificationError) {
        logger.warn("Error sending confirmation notifications", {
          error: notificationError instanceof Error ? notificationError.message : "Unknown error",
          jobId: job.id,
        });
        // Don't fail job creation for notification errors
      }
    }

    // Handle feedback email sending if enabled
    try {
      logger.debug("Checking feedback email settings", {
        organizationId,
      });

      // Fetch organization settings to check if feedback emails are enabled
      const { data: orgSettings, error: orgSettingsError } = await supabaseAdmin
        .from("organization")
        .select("feedback_email_send_immediately, name")
        .eq("id", organizationId)
        .single();

      if (orgSettingsError) {
        logger.warn("Error fetching organization settings for feedback email", {
          error: orgSettingsError,
          organizationId,
        });
        // Don't fail job creation if we can't check settings
      } else if (orgSettings?.feedback_email_send_immediately) {
        logger.debug("Feedback email sending is enabled");

        // Generate feedback token
        const feedbackToken = generateFeedbackToken();
        logger.debug("Generated feedback token", {
          tokenLength: feedbackToken.length,
        });

        // Fetch invoice template config for email recipient configuration
        const { data: templateConfig } = await supabaseAdmin
          .from("invoice_template_config")
          .select("email_recipient_config")
          .eq("organization_id", organizationId)
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
          .eq("organization_id", organizationId)
          .eq("active", true);

        const fieldConfigMap = new Map<string, { name: string }>(
          (fieldConfigs || []).map(
            (fc: { id: string; name: string }) => [fc.id, { name: fc.name }],
          ),
        );

        // Fetch job with location details for email recipient determination
        const { data: jobWithLocation, error: jobLocationError } =
          await supabaseAdmin
            .from("job")
            .select(
              `
              id,
              location_id,
              submission_data,
              completed_at,
              location:location_id (
                id,
                email,
                contact_person,
                name,
                hierarchy_parent_id
              )
            `,
            )
            .eq("id", job.id)
            .single();

        if (jobLocationError || !jobWithLocation) {
          logger.error(
            "Error fetching job with location for feedback email",
            jobLocationError,
            {
              jobId: job.id,
            },
          );
          // Still update job with token for manual sending later
          await supabaseAdmin
            .from("job")
            .update({ feedback_token: feedbackToken })
            .eq("id", job.id);
        } else {
          // Handle location (Supabase returns it as array or object depending on query)
          const locationData = Array.isArray(jobWithLocation.location)
            ? jobWithLocation.location[0]
            : jobWithLocation.location;

          // Build job context for email recipient determination
          const jobContext: JobContext = {
            location_id: jobWithLocation.location_id,
            location: locationData
              ? {
                id: locationData.id,
                email: locationData.email || null,
                contact_person: locationData.contact_person || null,
                hierarchy_parent_id: locationData.hierarchy_parent_id || null,
              }
              : null,
            submission_data: jobWithLocation.submission_data as
              | Record<
                string,
                unknown
              >
              | null,
          };

          // Get email recipient
          const recipientEmail = await getFeedbackEmailRecipient(
            supabaseAdmin,
            jobContext,
            emailConfig,
            fieldConfigMap,
          );

          if (recipientEmail) {
            logger.debug("Found feedback email recipient", {
              email: recipientEmail,
              jobId: job.id,
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
              jobCompletedAt: jobWithLocation.completed_at,
              locationName: locationData?.name || null,
              feedbackToken,
              feedbackReviewUrl: "", // Will be set by sendFeedbackRequestEmail
            };

            // Send feedback email
            const emailResult = await sendFeedbackRequestEmail(
              supabaseAdmin,
              feedbackEmailData,
              false, // Don't throw on error - job creation should succeed
            );

            if (emailResult.success) {
              logger.info("Feedback email sent successfully", {
                emailId: emailResult.emailId,
                jobId: job.id,
                recipientEmail,
              });

              // Update job with token and email tracking
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
                  error: updateError,
                  jobId: job.id,
                });
                // Job was created and email was sent, so this is non-critical
              }
            } else {
              logger.error("Failed to send feedback email", emailResult.error, {
                jobId: job.id,
                recipientEmail,
              });
              // Still update job with token for manual sending later
              await supabaseAdmin
                .from("job")
                .update({ feedback_token: feedbackToken })
                .eq("id", job.id);
            }
          } else {
            logger.warn("No feedback email recipient found for job", {
              jobId: job.id,
              locationId: jobWithLocation.location_id,
            });
            // Still update job with token for manual sending later
            await supabaseAdmin
              .from("job")
              .update({ feedback_token: feedbackToken })
              .eq("id", job.id);
          }
        }
      } else {
        logger.debug("Feedback email sending is disabled", {
          organizationId,
        });
      }
    } catch (feedbackError) {
      // Log error but don't fail job creation
      logger.error("Error in feedback email sending process", feedbackError, {
        jobId: job.id,
        organizationId,
      });
    }

    // Auto-generate invoice if enabled (for non-location orgs)
    // Uses shared utility to avoid code duplication with update-job
    const autoInvoiceResult = await autoGenerateInvoiceForJob({
      jobId: job.id,
      organizationId,
      locationId: job.location_id,
      supabaseAdmin,
      logger,
    });

    if (autoInvoiceResult.skipped) {
      logger.debug("Auto-invoice generation skipped", {
        jobId: job.id,
        reason: autoInvoiceResult.skipReason,
      });
    } else if (!autoInvoiceResult.success) {
      // Log but don't fail job creation
      logger.warn("Auto-invoice generation failed", {
        jobId: job.id,
        error: autoInvoiceResult.error,
      });
    }

    logger.info("Job creation completed successfully", {
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
      201,
    );
  } catch (error) {
    logger.error("Create job error", error);

    return errorResponse(
      extractErrorMessage(error, "Failed to create job"),
      getErrorStatusCode(error),
    );
  }
});
