/**
 * Computed feedback request status for completed-jobs list/detail (S2 F6).
 * Pure helper — list-jobs batch-loads facts, then calls this per job.
 */

export type FeedbackRequestStatusChip =
  | "responded"
  | "feedback_off"
  | "muted"
  | "cancelled"
  | "no_recipient"
  | "edit_window"
  | "queued"
  | "failed"
  | "sent"
  | "ready"
  | "config_error";

export type FeedbackOutboxStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | null;

export type FeedbackRequestStatus = {
  chip: FeedbackRequestStatusChip;
  label: string;
  can_send: boolean;
  block_reason: string | null;
  requires_confirm_flagged: boolean;
  requires_confirm_test: boolean;
  requires_confirm_resend: boolean;
  outbox_status: FeedbackOutboxStatus;
  send_after: string | null;
  last_error: string | null;
};

export type FeedbackRequestStatusInput = {
  orgFeedbackEnabled: boolean;
  locationMuted: boolean;
  approvalStatus: string | null | undefined;
  hasPrivateFeedback: boolean;
  feedbackEmailSent: boolean;
  editWindowExpiresAt: string | null | undefined;
  hasRecipientHint: boolean;
  mode: "internal" | "public" | "both";
  hasPublicReviewUrl: boolean;
  isTest: boolean;
  outboxStatus: FeedbackOutboxStatus;
  sendAfter: string | null;
  lastError: string | null;
  nowMs?: number;
};

const LABELS: Record<FeedbackRequestStatusChip, string> = {
  responded: "Responded",
  feedback_off: "Feedback off",
  muted: "Muted",
  cancelled: "Cancelled",
  no_recipient: "No recipient",
  edit_window: "Edit window",
  queued: "Queued",
  failed: "Failed",
  sent: "Sent",
  ready: "Ready to send",
  config_error: "Config error",
};

function isEditWindowOpen(editWindowExpiresAt: string | null | undefined, nowMs: number): boolean {
  if (!editWindowExpiresAt) return false;
  const ms = Date.parse(editWindowExpiresAt);
  return Number.isFinite(ms) && ms > nowMs;
}

/**
 * Chip priority (first match wins).
 *
 * S2 F6 listed: Feedback off → Muted → No recipient → Queued → Failed → Sent → Responded.
 * Adaptations (intentional):
 * - Responded is elevated above Sent (a completed private review must not read as merely Sent).
 * - Queued/Failed are evaluated before Sent so a pending/failed outbox is not masked by
 *   `feedback_email_sent` (avoids showing Resend while another send is already in flight).
 * - Job cancelled, edit window, and config_error are explicit blocks used by the UI.
 */
export function computeFeedbackRequestStatus(
  input: FeedbackRequestStatusInput
): FeedbackRequestStatus {
  const nowMs = input.nowMs ?? Date.now();
  const outboxStatus = input.outboxStatus ?? null;
  const alreadySent = input.feedbackEmailSent === true || outboxStatus === "succeeded";
  const base = {
    requires_confirm_flagged: input.approvalStatus === "flagged",
    requires_confirm_test: input.isTest === true,
    requires_confirm_resend: alreadySent,
    outbox_status: outboxStatus,
    send_after: input.sendAfter,
    last_error: input.lastError,
  };

  const result = (
    chip: FeedbackRequestStatusChip,
    canSend: boolean,
    blockReason: string | null
  ): FeedbackRequestStatus => ({
    chip,
    label: LABELS[chip],
    can_send: canSend,
    block_reason: blockReason,
    ...base,
  });

  if (input.hasPrivateFeedback && input.mode !== "public") {
    return result("responded", false, "Private feedback already submitted");
  }

  if (!input.orgFeedbackEnabled) {
    return result("feedback_off", false, "Feedback requests are disabled for this organization");
  }

  if (input.locationMuted) {
    return result("muted", false, "Feedback requests are muted for this location");
  }

  if (input.approvalStatus === "cancelled") {
    return result("cancelled", false, "Cancelled jobs cannot receive feedback requests");
  }

  // In-flight / failed outbox must win over historical "sent" so the UI does not offer
  // a concurrent resend while a row is still pending/processing, and so failed retries surface.
  if (outboxStatus === "pending" || outboxStatus === "processing") {
    return result("queued", false, "Feedback request is already queued");
  }

  if (outboxStatus === "failed") {
    // Retry is allowed; keep the failure detail on last_error, not block_reason.
    return result("failed", true, null);
  }

  if (alreadySent) {
    return result("sent", true, null);
  }

  if (isEditWindowOpen(input.editWindowExpiresAt, nowMs)) {
    return result("edit_window", false, "Feedback can’t be sent until the edit window ends");
  }

  if ((input.mode === "public" || input.mode === "both") && !input.hasPublicReviewUrl) {
    return result(
      "config_error",
      false,
      "Public review URL (https) is required for the current feedback mode"
    );
  }

  if (!input.hasRecipientHint) {
    return result(
      "no_recipient",
      false,
      "No email recipient found. Configure location email, form field email, or default email."
    );
  }

  return result("ready", true, null);
}

/** Lightweight recipient presence check used by list-jobs status enrichment. */
export function hasFeedbackRecipientHint(params: {
  locationEmail?: string | null;
  defaultEmail?: string | null;
  formEmail?: string | null;
}): boolean {
  const trim = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");
  return !!(trim(params.locationEmail) || trim(params.defaultEmail) || trim(params.formEmail));
}
