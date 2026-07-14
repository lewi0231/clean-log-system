import { createLogger } from "../../_utils/logger.ts";
import { createNotification } from "../../_utils/notifications.ts";
import type { CreateJobContext, ValidatedCreateJobRequest } from "./types.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/** Row shape needed after insert (response + side effects) */
export type InsertedJobRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  completed_at: string | null;
  created_at: string | null;
};

/**
 * Insert job, completion notification, job_worker rows, optional colleague-confirmation admin notification.
 */
export async function insertJobAndRelatedRecords(
  logger: EdgeLogger,
  ctx: CreateJobContext,
  validated: ValidatedCreateJobRequest
): Promise<{ job: InsertedJobRow }> {
  const {
    supabaseAdmin,
    authUser,
    userEmail,
    organizationId,
    confirmationTimeoutHours,
    editWindowMinutes,
  } = ctx;

  const { normalizedLocationId, colleagueIds, submissionDataJsonb } = validated;

  const submittingWorkerId = authUser.user_metadata?.worker_id ?? null;

  const hasColleagues = colleagueIds && Array.isArray(colleagueIds) && colleagueIds.length > 0;
  const hasOtherColleagues =
    hasColleagues && (!submittingWorkerId || colleagueIds.some((id) => id !== submittingWorkerId));
  const needsConfirmation = submittingWorkerId && hasOtherColleagues;

  const now = new Date();
  const autoApproveAt = needsConfirmation
    ? new Date(now.getTime() + confirmationTimeoutHours * 60 * 60 * 1000).toISOString()
    : null;
  const editWindowExpiresAt = needsConfirmation
    ? new Date(now.getTime() + editWindowMinutes * 60 * 1000).toISOString()
    : null;

  const jobInsertData = {
    organization_id: organizationId,
    location_id: normalizedLocationId,
    submission_data: submissionDataJsonb,
    completed_at: now.toISOString(),
    submitted_by_email: userEmail,
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

  const colleaguesNeedingNotification: string[] = [];

  if (colleagueIds && Array.isArray(colleagueIds) && colleagueIds.length > 0) {
    const confirmedAt = now.toISOString();
    const jobWorkerEntries = colleagueIds.map((workerId) => {
      const isSubmitter = workerId === submittingWorkerId;
      const isConfirmed = !needsConfirmation || isSubmitter;

      if (!isConfirmed) {
        colleaguesNeedingNotification.push(workerId);
      }

      return {
        job_id: job.id,
        worker_id: workerId,
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

  if (colleaguesNeedingNotification.length > 0) {
    try {
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

      const autoApproveDate = autoApproveAt ? new Date(autoApproveAt) : null;
      const timeUntilAutoApprove = autoApproveDate ? `${confirmationTimeoutHours} hours` : "soon";

      logger.debug("Sending confirmation notifications to colleagues", {
        jobId: job.id,
        colleagueCount: colleaguesNeedingNotification.length,
        locationName,
        timeUntilAutoApprove,
      });

      const confirmNotifyResult = await createNotification(supabaseAdmin, {
        organization_id: job.organization_id,
        type: "job_confirmation_requested",
        title: "Job Pending Confirmation",
        message: `A job at ${locationName} requires colleague confirmation. It will auto-approve in ${timeUntilAutoApprove}.`,
        related_entity_type: "job",
        related_entity_id: job.id,
      });

      if (!confirmNotifyResult.success) {
        logger.warn("Failed to create confirmation request notification", {
          error: confirmNotifyResult.error,
          jobId: job.id,
        });
      }
    } catch (notificationError) {
      logger.warn("Error sending confirmation notifications", {
        error: notificationError instanceof Error ? notificationError.message : "Unknown error",
        jobId: job.id,
      });
    }
  }

  return {
    job: job as InsertedJobRow,
  };
}
