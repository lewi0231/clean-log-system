import { autoGenerateInvoiceForJob } from "../../_utils/auto-invoice.ts";
import { jsonResponse } from "../../_utils/http.ts";
import { createLogger } from "../../_utils/logger.ts";
import { insertJobAndRelatedRecords } from "./insert-job-and-related-records.ts";
import { maybeSendJobFeedbackEmail } from "./maybe-send-job-feedback-email.ts";
import type { CreateJobContext, ValidatedCreateJobRequest } from "./types.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/** Orchestration after validated request — insert, feedback email, auto-invoice, response */
export async function runCreateJobPersistence(
  logger: EdgeLogger,
  ctx: CreateJobContext,
  validated: ValidatedCreateJobRequest
): Promise<Response> {
  const { organizationId, supabaseAdmin } = ctx;

  const { job } = await insertJobAndRelatedRecords(logger, ctx, validated);

  await maybeSendJobFeedbackEmail(logger, supabaseAdmin, organizationId, job);

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
    201
  );
}
