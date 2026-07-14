import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FeedbackEmailData,
  generateFeedbackToken,
  getFeedbackEmailRecipient,
  sendFeedbackRequestEmail,
} from "../../_utils/feedback-email.ts";
import type { InvoiceEmailRecipientConfig, JobContext } from "../../_utils/invoice-email.ts";
import { createLogger } from "../../_utils/logger.ts";
import type { InsertedJobRow } from "./insert-job-and-related-records.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/**
 * If org enables immediate feedback email, resolve recipient and send — never throws to caller.
 */
export async function maybeSendJobFeedbackEmail(
  logger: EdgeLogger,
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  job: InsertedJobRow
): Promise<void> {
  try {
    logger.debug("Checking feedback email settings", {
      organizationId,
    });

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
    } else if (orgSettings?.feedback_email_send_immediately) {
      logger.debug("Feedback email sending is enabled");

      const feedbackToken = generateFeedbackToken();
      logger.debug("Generated feedback token", {
        tokenLength: feedbackToken.length,
      });

      const { data: templateConfig } = await supabaseAdmin
        .from("invoice_template_config")
        .select("email_recipient_config")
        .eq("organization_id", organizationId)
        .single();

      const emailConfig: InvoiceEmailRecipientConfig =
        (templateConfig?.email_recipient_config as InvoiceEmailRecipientConfig) || {
          location_email_source: "location_email",
          form_field_email: null,
          default_email: null,
        };

      const { data: fieldConfigs } = await supabaseAdmin
        .from("organization_field_configs")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("active", true);

      const fieldConfigMap = new Map<string, { name: string }>(
        (fieldConfigs || []).map((fc: { id: string; name: string }) => [fc.id, { name: fc.name }])
      );

      const { data: jobWithLocation, error: jobLocationError } = await supabaseAdmin
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
            `
        )
        .eq("id", job.id)
        .single();

      if (jobLocationError || !jobWithLocation) {
        logger.error("Error fetching job with location for feedback email", jobLocationError, {
          jobId: job.id,
        });
        await supabaseAdmin.from("job").update({ feedback_token: feedbackToken }).eq("id", job.id);
      } else {
        const locationData = Array.isArray(jobWithLocation.location)
          ? jobWithLocation.location[0]
          : jobWithLocation.location;

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
          submission_data: jobWithLocation.submission_data as Record<string, unknown> | null,
        };

        const recipientEmail = await getFeedbackEmailRecipient(
          supabaseAdmin,
          jobContext,
          emailConfig,
          fieldConfigMap
        );

        if (recipientEmail) {
          logger.debug("Found feedback email recipient", {
            email: recipientEmail,
            jobId: job.id,
          });

          const recipientName = locationData?.contact_person || null;

          const feedbackEmailData: FeedbackEmailData = {
            recipientEmail,
            recipientName,
            organizationName: orgSettings.name || "Our Team",
            organizationId: job.organization_id,
            jobId: job.id,
            jobCompletedAt: jobWithLocation.completed_at,
            locationName: locationData?.name || null,
            feedbackToken,
            feedbackReviewUrl: "",
          };

          const emailResult = await sendFeedbackRequestEmail(
            supabaseAdmin,
            feedbackEmailData,
            false
          );

          if (emailResult.success) {
            logger.info("Feedback email sent successfully", {
              emailId: emailResult.emailId,
              jobId: job.id,
              recipientEmail,
            });

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
            }
          } else {
            logger.error("Failed to send feedback email", emailResult.error, {
              jobId: job.id,
              recipientEmail,
            });
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
    logger.error("Error in feedback email sending process", feedbackError, {
      jobId: job.id,
      organizationId,
    });
  }
}
