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
  console.log("📥 Admin Create Job: Request received", {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!req.headers.get("authorization"),
  });

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    console.log("🔐 Admin Create Job: Authentication check", {
      hasToken: !!token,
      tokenLength: token?.length || 0,
    });

    if (!token) {
      console.error("❌ Admin Create Job: No authentication token provided");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser || !authUser.email) {
      console.error(
        "❌ Admin Create Job: User not found after token verification",
      );
      return errorResponse("User not found", 401);
    }

    const userEmail = authUser.email;
    console.log("✅ Admin Create Job: Token verified", {
      userId: authUser.id,
      email: userEmail,
    });

    // Get organization_id from organization_user table
    console.log("👤 Admin Create Job: Fetching organization user", {
      email: userEmail,
    });
    const { data: orgUser, error: orgUserError } = await supabaseAdmin
      .from("organization_user")
      .select("organization_id, role")
      .eq("email", userEmail)
      .maybeSingle();

    if (orgUserError) {
      console.error("❌ Admin Create Job: Error fetching organization user", {
        error: orgUserError.message,
        code: orgUserError.code,
        details: orgUserError.details,
      });
      throw orgUserError;
    }

    if (!orgUser) {
      console.error("❌ Admin Create Job: Organization user not found", {
        email: userEmail,
      });
      return errorResponse("Organization user not found", 404);
    }

    // Check if user is admin
    if (orgUser.role !== "admin") {
      console.error("❌ Admin Create Job: User is not an admin", {
        email: userEmail,
        role: orgUser.role,
      });
      return errorResponse("Only admin users can create jobs", 403);
    }

    const organizationId = orgUser.organization_id;
    console.log("✅ Admin Create Job: Admin user found", {
      organizationId,
      role: orgUser.role,
    });

    // Fetch organization settings to check if predefined locations are required
    console.log("🏢 Admin Create Job: Fetching organization settings", {
      organizationId,
    });
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organization")
      .select("use_predefined_locations")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error(
        "❌ Admin Create Job: Error fetching organization settings",
        {
          error: orgError.message,
          code: orgError.code,
          details: orgError.details,
        },
      );
      throw orgError;
    }

    const usePredefinedLocations = organization?.use_predefined_locations ??
      true;
    console.log("✅ Admin Create Job: Organization settings fetched", {
      usePredefinedLocations,
    });

    // Parse request body
    console.log("📦 Admin Create Job: Parsing request body");
    let body;
    try {
      body = await req.json();
      console.log("📦 Admin Create Job: Request body parsed", {
        hasOrganizationId: !!body.organization_id,
        hasSubmissionData: !!body.submission_data,
        hasWorkerIds: !!body.worker_ids,
        hasLocationId: !!body.location_id,
        hasCompletedAt: !!body.completed_at,
      });
    } catch (parseError) {
      console.error("❌ Admin Create Job: Failed to parse request body", {
        error: parseError instanceof Error
          ? parseError.message
          : String(parseError),
      });
      return errorResponse("Invalid request body", 400);
    }

    // Validate organization_id matches authenticated user's organization
    if (body.organization_id !== organizationId) {
      console.error("❌ Admin Create Job: Organization ID mismatch", {
        provided: body.organization_id,
        expected: organizationId,
      });
      return errorResponse(
        "Organization ID does not match your organization",
        403,
      );
    }

    // Validate submission_data
    const { submission_data, worker_ids, location_id, completed_at } = body;

    if (!submission_data || typeof submission_data !== "object") {
      console.error("❌ Admin Create Job: Invalid submission_data", {
        hasSubmissionData: !!submission_data,
        type: typeof submission_data,
      });
      return errorResponse("submission_data is required", 400);
    }

    // Normalize location_id (handle empty strings)
    const normalizedLocationId =
      location_id && typeof location_id === "string" &&
        location_id.trim() !== ""
        ? location_id.trim()
        : null;

    console.log("📍 Admin Create Job: Location normalization", {
      originalLocationId: location_id,
      normalizedLocationId,
      usePredefinedLocations,
    });

    // Check if location_id is required based on organization settings
    if (usePredefinedLocations && !normalizedLocationId) {
      console.error("❌ Admin Create Job: Location ID is required", {
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
      console.log("📍 Admin Create Job: Validating location", {
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
        console.error("❌ Admin Create Job: Error validating location", {
          error: locationError.message,
          code: locationError.code,
          details: locationError.details,
        });
        throw locationError;
      }

      if (!location) {
        console.error("❌ Admin Create Job: Location not found", {
          locationId: normalizedLocationId,
          organizationId,
        });
        return errorResponse(
          "Location not found or does not belong to your organization",
          400,
        );
      }
      console.log("✅ Admin Create Job: Location validated", {
        locationId: location.id,
      });
    }

    // Validate worker_ids if provided
    const normalizedWorkerIds =
      Array.isArray(worker_ids) && worker_ids.length > 0
        ? worker_ids.filter((id: unknown) =>
          typeof id === "string" && id.trim() !== ""
        )
        : [];

    if (normalizedWorkerIds.length > 0) {
      console.log("👥 Admin Create Job: Validating workers", {
        workerIds: normalizedWorkerIds,
        organizationId,
      });
      const { data: workers, error: workersError } = await supabaseAdmin
        .from("worker")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", normalizedWorkerIds);

      if (workersError) {
        console.error("❌ Admin Create Job: Error validating workers", {
          error: workersError.message,
          code: workersError.code,
          details: workersError.details,
        });
        throw workersError;
      }

      // Check if all worker_ids were found and belong to the organization
      if (!workers || workers.length !== normalizedWorkerIds.length) {
        console.error("❌ Admin Create Job: Not all workers found", {
          requestedCount: normalizedWorkerIds.length,
          foundCount: workers?.length || 0,
          requestedIds: normalizedWorkerIds,
          foundIds: workers?.map((w) => w.id) || [],
        });
        return errorResponse(
          "One or more workers not found or do not belong to your organization",
          400,
        );
      }
      console.log("✅ Admin Create Job: All workers validated", {
        count: workers.length,
      });
    }

    // Normalize completed_at (default to now if not provided)
    const normalizedCompletedAt =
      completed_at && typeof completed_at === "string"
        ? completed_at
        : new Date().toISOString();

    // Create the job
    const jobInsertData = {
      organization_id: organizationId,
      location_id: normalizedLocationId,
      submission_data: submission_data,
      completed_at: normalizedCompletedAt,
    };
    console.log("💾 Admin Create Job: Inserting job", {
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
      console.error("❌ Admin Create Job: Error creating job", {
        error: jobError.message,
        code: jobError.code,
        details: jobError.details,
        hint: jobError.hint,
      });
      throw jobError;
    }

    console.log("✅ Admin Create Job: Job created successfully", {
      jobId: job.id,
      organizationId: job.organization_id,
    });

    // Create job_worker entries if worker_ids provided
    if (normalizedWorkerIds.length > 0) {
      const jobWorkerEntries = normalizedWorkerIds.map((workerId: string) => ({
        job_id: job.id,
        worker_id: workerId,
      }));

      console.log("👥 Admin Create Job: Creating job_worker entries", {
        jobId: job.id,
        entriesCount: jobWorkerEntries.length,
        entries: jobWorkerEntries,
      });

      const { error: jobWorkerError } = await supabaseAdmin
        .from("job_worker")
        .insert(jobWorkerEntries);

      if (jobWorkerError) {
        console.error(
          "❌ Admin Create Job: Error creating job_worker entries",
          {
            error: jobWorkerError.message,
            code: jobWorkerError.code,
            details: jobWorkerError.details,
            hint: jobWorkerError.hint,
          },
        );
        throw jobWorkerError;
      }
      console.log(
        "✅ Admin Create Job: Job_worker entries created successfully",
      );
    }

    // Handle feedback email sending if enabled
    try {
      console.log("📧 Admin Create Job: Checking feedback email settings", {
        organizationId,
      });

      // Fetch organization settings to check if feedback emails are enabled
      const { data: orgSettings, error: orgSettingsError } = await supabaseAdmin
        .from("organization")
        .select("feedback_email_send_immediately, name")
        .eq("id", organizationId)
        .single();

      if (orgSettingsError) {
        console.error(
          "❌ Admin Create Job: Error fetching organization settings for feedback email",
          {
            error: orgSettingsError.message,
          },
        );
        // Don't fail job creation if we can't check settings
      } else if (orgSettings?.feedback_email_send_immediately) {
        console.log("📧 Admin Create Job: Feedback email sending is enabled");

        // Generate feedback token
        const feedbackToken = generateFeedbackToken();
        console.log("🔑 Admin Create Job: Generated feedback token", {
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
          console.error(
            "❌ Admin Create Job: Error fetching job with location for feedback email",
            {
              error: jobLocationError?.message,
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
            console.log("📧 Admin Create Job: Found feedback email recipient", {
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
              jobCompletedAt: jobWithLocation.completed_at,
              locationName: locationData?.name || null,
              feedbackToken,
              feedbackReviewUrl: "", // Will be set by sendFeedbackRequestEmail
            };

            // Send feedback email
            const emailResult = await sendFeedbackRequestEmail(
              feedbackEmailData,
              false, // Don't throw on error - job creation should succeed
            );

            if (emailResult.success) {
              console.log(
                "✅ Admin Create Job: Feedback email sent successfully",
                {
                  emailId: emailResult.emailId,
                },
              );

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
                console.error(
                  "❌ Admin Create Job: Error updating job with feedback email tracking",
                  {
                    error: updateError.message,
                  },
                );
                // Job was created and email was sent, so this is non-critical
              }
            } else {
              console.error(
                "❌ Admin Create Job: Failed to send feedback email",
                {
                  error: emailResult.error,
                },
              );
              // Still update job with token for manual sending later
              await supabaseAdmin
                .from("job")
                .update({ feedback_token: feedbackToken })
                .eq("id", job.id);
            }
          } else {
            console.warn(
              "⚠️ Admin Create Job: No feedback email recipient found for job",
              {
                jobId: job.id,
                locationId: jobWithLocation.location_id,
              },
            );
            // Still update job with token for manual sending later
            await supabaseAdmin
              .from("job")
              .update({ feedback_token: feedbackToken })
              .eq("id", job.id);
          }
        }
      } else {
        console.log("📧 Admin Create Job: Feedback email sending is disabled");
      }
    } catch (feedbackError) {
      // Log error but don't fail job creation
      console.error(
        "❌ Admin Create Job: Error in feedback email sending process",
        {
          error: feedbackError instanceof Error
            ? feedbackError.message
            : String(feedbackError),
        },
      );
    }

    console.log("✅ Admin Create Job: Request completed successfully", {
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
      201,
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

    console.error("❌ Admin Create Job: Unhandled error", errorLog);

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to create job";

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
      } else if (error.message.includes("does not match")) {
        statusCode = 403;
      }
    }

    console.error("❌ Admin Create Job: Returning error response", {
      statusCode,
      errorMessage,
    });

    return errorResponse(errorMessage, statusCode);
  }
});
