import type { FeedbackRequestStatus, FeedbackRequestStatusChip, Job } from "@/lib/types";

export type CompletedJobStatusBadge = {
  key: string;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
};

const SHORT_FEEDBACK_LABELS: Partial<Record<FeedbackRequestStatusChip, string>> = {
  responded: "Feedback",
  sent: "Feedback sent",
  queued: "Feedback queued",
  failed: "Feedback failed",
  ready: "Awaiting feedback",
  edit_window: "Feedback hold",
  no_recipient: "No recipient",
  config_error: "Feedback config",
  muted: "Muted",
};

/** Chips that are noise in the dense list (org-off / cancelled). */
const HIDDEN_FEEDBACK_CHIPS = new Set<FeedbackRequestStatusChip>(["feedback_off", "cancelled"]);

function feedbackBadgeFromStatus(
  status: FeedbackRequestStatus | undefined
): CompletedJobStatusBadge | null {
  if (!status || HIDDEN_FEEDBACK_CHIPS.has(status.chip)) return null;
  const label = SHORT_FEEDBACK_LABELS[status.chip];
  if (!label) return null;

  let variant: CompletedJobStatusBadge["variant"] = "outline";
  if (status.chip === "responded" || status.chip === "sent") variant = "secondary";
  if (status.chip === "failed" || status.chip === "config_error") variant = "destructive";
  if (status.chip === "queued" || status.chip === "ready") variant = "default";

  return { key: `feedback-${status.chip}`, label, variant, className: "text-xs" };
}

function legacyFeedbackBadge(
  job: Pick<Job, "has_feedback" | "feedback_email_sent" | "feedback_token">
): CompletedJobStatusBadge | null {
  if (job.has_feedback) {
    return {
      key: "feedback-responded",
      label: "Feedback",
      variant: "secondary",
      className: "text-xs",
    };
  }
  if (job.feedback_email_sent) {
    return {
      key: "feedback-sent",
      label: "Feedback sent",
      variant: "secondary",
      className: "text-xs",
    };
  }
  if (job.feedback_token) {
    return {
      key: "feedback-pending",
      label: "Awaiting feedback",
      variant: "outline",
      className: "text-xs",
    };
  }
  return null;
}

function invoiceBadge(job: Pick<Job, "invoice_job">): CompletedJobStatusBadge {
  const invoices = job.invoice_job?.filter((ij) => ij.invoice !== null) || [];
  if (invoices.length === 0) {
    return { key: "invoice-none", label: "Not invoiced", variant: "outline" };
  }
  return { key: "invoice-created", label: "Invoiced", variant: "secondary" };
}

/**
 * Status-column chips for completed-jobs list (excluding JobStatusBadge for approval).
 * Order: TEST → invoice → feedback.
 */
export function getCompletedJobStatusBadges(
  job: Pick<
    Job,
    | "is_test"
    | "invoice_job"
    | "has_feedback"
    | "feedback_email_sent"
    | "feedback_token"
    | "feedback_request_status"
  >
): CompletedJobStatusBadge[] {
  const badges: CompletedJobStatusBadge[] = [];

  if (job.is_test) {
    badges.push({
      key: "test",
      label: "TEST",
      variant: "destructive",
      className: "w-fit text-[10px] tracking-wide",
    });
  }

  badges.push(invoiceBadge(job));

  // has_feedback wins over a stale/ready status chip so "Feedback" is never masked.
  const feedback = job.has_feedback
    ? legacyFeedbackBadge(job)
    : (feedbackBadgeFromStatus(job.feedback_request_status) ?? legacyFeedbackBadge(job));
  if (feedback) badges.push(feedback);

  return badges;
}
