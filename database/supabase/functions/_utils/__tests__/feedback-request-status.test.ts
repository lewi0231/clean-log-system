/**
 * Run: deno test --allow-all supabase/functions/_utils/__tests__/feedback-request-status.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  computeFeedbackRequestStatus,
  hasFeedbackRecipientHint,
} from "../feedback-request-status.ts";

const base = {
  orgFeedbackEnabled: true,
  locationMuted: false,
  approvalStatus: "approved" as string | null,
  hasPrivateFeedback: false,
  feedbackEmailSent: false,
  editWindowExpiresAt: null as string | null,
  hasRecipientHint: true,
  mode: "internal" as const,
  hasPublicReviewUrl: false,
  isTest: false,
  outboxStatus: null as null,
  sendAfter: null as string | null,
  lastError: null as string | null,
  nowMs: Date.parse("2026-07-26T00:00:00.000Z"),
};

Deno.test("responded wins over sent when private feedback exists", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    hasPrivateFeedback: true,
    feedbackEmailSent: true,
  });
  assertEquals(s.chip, "responded");
  assertEquals(s.can_send, false);
});

Deno.test("public mode does not chip responded for private feedback", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    mode: "public",
    hasPrivateFeedback: true,
    hasPublicReviewUrl: true,
  });
  assertEquals(s.chip, "ready");
});

Deno.test("feedback_off blocks send", () => {
  const s = computeFeedbackRequestStatus({ ...base, orgFeedbackEnabled: false });
  assertEquals(s.chip, "feedback_off");
  assertEquals(s.can_send, false);
});

Deno.test("muted blocks send", () => {
  const s = computeFeedbackRequestStatus({ ...base, locationMuted: true });
  assertEquals(s.chip, "muted");
});

Deno.test("queued wins over historical sent (no concurrent resend)", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    feedbackEmailSent: true,
    outboxStatus: "pending",
    sendAfter: "2026-07-26T12:00:00.000Z",
  });
  assertEquals(s.chip, "queued");
  assertEquals(s.can_send, false);
  assertEquals(s.requires_confirm_resend, true);
});

Deno.test("failed wins over historical sent so retries surface", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    feedbackEmailSent: true,
    outboxStatus: "failed",
    lastError: "resend_timeout",
  });
  assertEquals(s.chip, "failed");
  assertEquals(s.can_send, true);
  assertEquals(s.block_reason, null);
  assertEquals(s.last_error, "resend_timeout");
  assertEquals(s.requires_confirm_resend, true);
});

Deno.test("queued when outbox pending", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    outboxStatus: "pending",
    sendAfter: "2026-07-26T12:00:00.000Z",
  });
  assertEquals(s.chip, "queued");
  assertEquals(s.can_send, false);
});

Deno.test("edit_window blocks when expires_at in future", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    editWindowExpiresAt: "2026-07-26T03:00:00.000Z",
  });
  assertEquals(s.chip, "edit_window");
  assertEquals(s.can_send, false);
});

Deno.test("edit_window closed at exact expiry boundary", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    editWindowExpiresAt: "2026-07-26T00:00:00.000Z",
    nowMs: Date.parse("2026-07-26T00:00:00.000Z"),
  });
  assertEquals(s.chip, "ready");
});

Deno.test("invalid edit_window timestamp does not block", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    editWindowExpiresAt: "not-a-date",
  });
  assertEquals(s.chip, "ready");
});

Deno.test("ready when nothing blocking", () => {
  const s = computeFeedbackRequestStatus(base);
  assertEquals(s.chip, "ready");
  assertEquals(s.can_send, true);
});

Deno.test("sent allows resend with confirm flag", () => {
  const s = computeFeedbackRequestStatus({ ...base, feedbackEmailSent: true });
  assertEquals(s.chip, "sent");
  assertEquals(s.can_send, true);
  assertEquals(s.requires_confirm_resend, true);
});

Deno.test("outbox succeeded counts as sent", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    outboxStatus: "succeeded",
  });
  assertEquals(s.chip, "sent");
  assertEquals(s.requires_confirm_resend, true);
});

Deno.test("config_error when public mode missing URL", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    mode: "both",
    hasPublicReviewUrl: false,
  });
  assertEquals(s.chip, "config_error");
  assertEquals(s.can_send, false);
});

Deno.test("cancelled job blocks send", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    approvalStatus: "cancelled",
  });
  assertEquals(s.chip, "cancelled");
  assertEquals(s.can_send, false);
});

Deno.test("flagged job is ready but requires confirm", () => {
  const s = computeFeedbackRequestStatus({
    ...base,
    approvalStatus: "flagged",
  });
  assertEquals(s.chip, "ready");
  assertEquals(s.can_send, true);
  assertEquals(s.requires_confirm_flagged, true);
});

Deno.test("hasFeedbackRecipientHint trims whitespace and ignores empties", () => {
  assertEquals(hasFeedbackRecipientHint({ locationEmail: "  " }), false);
  assertEquals(hasFeedbackRecipientHint({ defaultEmail: "a@b.co" }), true);
  assertEquals(hasFeedbackRecipientHint({ locationEmail: null, formEmail: " x@y.z " }), true);
});
