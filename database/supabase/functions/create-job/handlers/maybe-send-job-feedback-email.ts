import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOrSendFeedback } from "../../_utils/feedback-send.ts";
import { createLogger } from "../../_utils/logger.ts";
import type { InsertedJobRow } from "./insert-job-and-related-records.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/**
 * Auto-send path: enqueue/send via shared helper. Never throws to caller (PRESERVE-1).
 */
export async function maybeSendJobFeedbackEmail(
  logger: EdgeLogger,
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  job: InsertedJobRow
): Promise<void> {
  try {
    logger.debug("Checking feedback email settings", { organizationId });

    const result = await enqueueOrSendFeedback(supabaseAdmin, job.id, {
      path: "auto",
    });

    if (result.skipped) {
      logger.debug("Feedback email skipped", {
        jobId: job.id,
        reason: result.reason,
      });
      return;
    }

    if (result.queued) {
      logger.info("Feedback email queued", {
        jobId: job.id,
        outboxId: result.outboxId,
        reason: result.reason,
      });
      return;
    }

    if (result.sent) {
      logger.info("Feedback email sent successfully", {
        jobId: job.id,
        emailId: result.emailId,
        outboxId: result.outboxId,
      });
      return;
    }

    if (result.cancelled) {
      logger.info("Feedback email cancelled", {
        jobId: job.id,
        reason: result.reason,
      });
      return;
    }

    if (!result.ok) {
      logger.error("Feedback email enqueue/send failed", result.reason, {
        jobId: job.id,
        error_code: result.error_code,
      });
    }
  } catch (feedbackError) {
    logger.error("Error in feedback email sending process", feedbackError, {
      jobId: job.id,
      organizationId,
    });
  }
}
