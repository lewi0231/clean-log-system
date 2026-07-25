import type { FeedbackRequestStatus, FeedbackRequestStatusChip, Job } from "@/lib/types";
import type { SendFeedbackEmailOptions } from "@/lib/types/api";

const HIDDEN_SEND_CHIPS: ReadonlySet<FeedbackRequestStatusChip> = new Set([
  "responded",
  "feedback_off",
  "muted",
  "cancelled",
  "queued",
]);

export type FeedbackSendButtonState =
  | { visible: false }
  | {
      visible: true;
      label: "Send Feedback Email" | "Resend Feedback Email";
      disabled: boolean;
      blockReason: string | null;
      confirms: {
        requireFlagged: boolean;
        requireTest: boolean;
        requireResend: boolean;
      };
    };

/**
 * Pure UI decision for the completed-jobs feedback send button.
 * Keeps chip/confirm rules out of the dialog JSX.
 */
export function getFeedbackSendButtonState(
  job: Pick<Job, "feedback_request_status" | "feedback_email_sent" | "is_test">,
  status: FeedbackRequestStatus | null | undefined = job.feedback_request_status
): FeedbackSendButtonState {
  if (status != null && HIDDEN_SEND_CHIPS.has(status.chip)) {
    return { visible: false };
  }

  const sendBlocked = status != null && !status.can_send;
  const requireResend = !!(status?.requires_confirm_resend || job.feedback_email_sent);
  const requireTest = !!(status?.requires_confirm_test || job.is_test);
  const requireFlagged = !!status?.requires_confirm_flagged;

  return {
    visible: true,
    label: requireResend ? "Resend Feedback Email" : "Send Feedback Email",
    disabled: sendBlocked,
    blockReason: status?.block_reason ?? null,
    confirms: {
      requireFlagged,
      requireTest,
      requireResend,
    },
  };
}

export function buildFeedbackSendConfirms(
  state: Extract<FeedbackSendButtonState, { visible: true }>,
  answers: { flagged?: boolean; test?: boolean; resend?: boolean }
): SendFeedbackEmailOptions | null {
  const options: SendFeedbackEmailOptions = {};
  if (state.confirms.requireFlagged) {
    if (!answers.flagged) return null;
    options.confirm_flagged = true;
  }
  if (state.confirms.requireTest) {
    if (!answers.test) return null;
    options.confirm_test = true;
  }
  if (state.confirms.requireResend) {
    if (!answers.resend) return null;
    options.confirm_resend = true;
  }
  return options;
}
