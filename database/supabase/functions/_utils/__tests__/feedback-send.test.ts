/**
 * Unit tests for feedback send eligibility, timing, and cancel gates.
 */

import { assertEquals } from "@std/assert";
import { computeSendAfter, evaluateCancelGate } from "../feedback-send.ts";
import {
  escapeHtml,
  renderFeedbackEmailContent,
  type FeedbackEmailData,
} from "../feedback-email.ts";

Deno.test("computeSendAfter: delay only when no edit window", () => {
  const base = new Date("2026-07-21T00:00:00.000Z");
  const result = computeSendAfter({
    completedAt: base.toISOString(),
    createdAt: base.toISOString(),
    editWindowExpiresAt: null,
    delayHours: 2,
  });
  assertEquals(result.toISOString(), "2026-07-21T02:00:00.000Z");
});

Deno.test("computeSendAfter: edit window wins over shorter delay", () => {
  const base = new Date("2026-07-21T00:00:00.000Z");
  const windowEnd = new Date("2026-07-21T03:00:00.000Z");
  const result = computeSendAfter({
    completedAt: base.toISOString(),
    createdAt: base.toISOString(),
    editWindowExpiresAt: windowEnd.toISOString(),
    delayHours: 1,
  });
  assertEquals(result.toISOString(), windowEnd.toISOString());
});

Deno.test("computeSendAfter: delay wins when later than edit window", () => {
  const base = new Date("2026-07-21T00:00:00.000Z");
  const windowEnd = new Date("2026-07-21T01:00:00.000Z");
  const result = computeSendAfter({
    completedAt: base.toISOString(),
    createdAt: base.toISOString(),
    editWindowExpiresAt: windowEnd.toISOString(),
    delayHours: 5,
  });
  assertEquals(result.toISOString(), "2026-07-21T05:00:00.000Z");
});

Deno.test("evaluateCancelGate: kill switch cancels", () => {
  const reason = evaluateCancelGate({
    org: {
      name: "Org",
      locale: "en-AU",
      feedback_requests_enabled: false,
      feedback_auto_send: true,
      feedback_request_mode: "internal",
      public_review_url: null,
      feedback_email_subject: null,
      feedback_email_body: null,
      feedback_email_reply_to: null,
      feedback_send_delay_hours: 0,
    },
    locationMuted: false,
    approvalStatus: "approved",
    mode: "internal",
  });
  assertEquals(reason, "feedback_requests_disabled");
});

Deno.test("evaluateCancelGate: flagged cancels", () => {
  const reason = evaluateCancelGate({
    org: {
      name: "Org",
      locale: "en-AU",
      feedback_requests_enabled: true,
      feedback_auto_send: true,
      feedback_request_mode: "internal",
      public_review_url: null,
      feedback_email_subject: null,
      feedback_email_body: null,
      feedback_email_reply_to: null,
      feedback_send_delay_hours: 0,
    },
    locationMuted: false,
    approvalStatus: "flagged",
    mode: "internal",
  });
  assertEquals(reason, "job_flagged");
});

Deno.test("evaluateCancelGate: location mute cancels", () => {
  const reason = evaluateCancelGate({
    org: {
      name: "Org",
      locale: "en-AU",
      feedback_requests_enabled: true,
      feedback_auto_send: true,
      feedback_request_mode: "internal",
      public_review_url: null,
      feedback_email_subject: null,
      feedback_email_body: null,
      feedback_email_reply_to: null,
      feedback_send_delay_hours: 0,
    },
    locationMuted: true,
    approvalStatus: null,
    mode: "internal",
  });
  assertEquals(reason, "location_muted");
});

Deno.test("P0 XSS: malicious org name is escaped in HTML", () => {
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://app.example.com");
  const data: FeedbackEmailData = {
    recipientEmail: "a@b.com",
    recipientName: `<img src=x onerror=alert(1)>`,
    organizationName: `<script>alert("xss")</script>`,
    organizationId: "00000000-0000-0000-0000-000000000001",
    jobId: "job-1",
    jobCompletedAt: "2026-07-21T00:00:00.000Z",
    locationName: `Yard"><script>`,
    feedbackToken: "tok",
    feedbackReviewUrl: "",
    mode: "internal",
  };
  const rendered = renderFeedbackEmailContent(data);
  // Must not contain raw HTML tags from substitutions (escaped entity form is OK)
  assertEquals(/<script[\s>]/i.test(rendered.html), false);
  assertEquals(/<img[\s>]/i.test(rendered.html), false);
  assertEquals(rendered.html.includes(escapeHtml(`<script>alert("xss")</script>`)), true);
  assertEquals(rendered.html.includes("&lt;img"), true);
  Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");
});
