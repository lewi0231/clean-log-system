import { getCompletedJobStatusBadges } from "@/lib/completed-job-status-badges";
import type { FeedbackRequestStatus, Job } from "@/lib/types";
import { describe, expect, it } from "vitest";

function status(partial: Partial<FeedbackRequestStatus>): FeedbackRequestStatus {
  return {
    chip: "ready",
    label: "Ready to send",
    can_send: true,
    block_reason: null,
    requires_confirm_flagged: false,
    requires_confirm_test: false,
    requires_confirm_resend: false,
    outbox_status: null,
    send_after: null,
    last_error: null,
    ...partial,
  };
}

function job(partial: Partial<Job> = {}): Parameters<typeof getCompletedJobStatusBadges>[0] {
  return {
    is_test: false,
    invoice_job: [],
    has_feedback: false,
    feedback_email_sent: false,
    feedback_token: null,
    feedback_request_status: undefined,
    ...partial,
  };
}

describe("getCompletedJobStatusBadges", () => {
  it("stacks TEST, invoice, and short feedback in Status order", () => {
    const badges = getCompletedJobStatusBadges(
      job({
        is_test: true,
        invoice_job: [
          { invoice: { id: "inv-1", invoice_number: "1", status: "sent", paid_at: null } },
        ],
        feedback_request_status: status({ chip: "responded", label: "Responded" }),
      })
    );
    expect(badges.map((b) => b.label)).toEqual(["TEST", "Invoiced", "Feedback"]);
  });

  it("uses short invoice labels", () => {
    expect(getCompletedJobStatusBadges(job()).map((b) => b.label)).toEqual(["Not invoiced"]);
  });

  it("hides feedback_off noise", () => {
    const badges = getCompletedJobStatusBadges(
      job({
        feedback_request_status: status({ chip: "feedback_off", label: "Feedback off" }),
      })
    );
    expect(badges.some((b) => b.key.startsWith("feedback"))).toBe(false);
  });

  it("falls back to legacy has_feedback when status missing", () => {
    const badges = getCompletedJobStatusBadges(job({ has_feedback: true }));
    expect(badges.map((b) => b.label)).toContain("Feedback");
  });

  it("has_feedback wins over a stale ready status chip", () => {
    const badges = getCompletedJobStatusBadges(
      job({
        has_feedback: true,
        feedback_request_status: status({ chip: "ready", label: "Ready to send" }),
      })
    );
    expect(badges.map((b) => b.label)).toContain("Feedback");
    expect(badges.map((b) => b.label)).not.toContain("Awaiting feedback");
  });
});
