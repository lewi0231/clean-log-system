import { buildFeedbackSendConfirms, getFeedbackSendButtonState } from "@/lib/feedback-send-ui";
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

function job(
  partial: Partial<Job> = {}
): Pick<Job, "feedback_request_status" | "feedback_email_sent" | "is_test"> {
  return {
    feedback_request_status: status({}),
    feedback_email_sent: false,
    is_test: false,
    ...partial,
  };
}

describe("getFeedbackSendButtonState", () => {
  it("hides send for terminal / in-flight chips", () => {
    for (const chip of ["responded", "feedback_off", "muted", "cancelled", "queued"] as const) {
      const state = getFeedbackSendButtonState(
        job({ feedback_request_status: status({ chip, can_send: false }) })
      );
      expect(state.visible).toBe(false);
    }
  });

  it("shows resend when previously sent", () => {
    const state = getFeedbackSendButtonState(
      job({
        feedback_email_sent: true,
        feedback_request_status: status({
          chip: "sent",
          requires_confirm_resend: true,
        }),
      })
    );
    expect(state.visible).toBe(true);
    if (!state.visible) return;
    expect(state.label).toBe("Resend Feedback Email");
    expect(state.confirms.requireResend).toBe(true);
  });

  it("disables send when blocked (edit window / no recipient)", () => {
    const state = getFeedbackSendButtonState(
      job({
        feedback_request_status: status({
          chip: "edit_window",
          can_send: false,
          block_reason: "wait",
        }),
      })
    );
    expect(state.visible).toBe(true);
    if (!state.visible) return;
    expect(state.disabled).toBe(true);
    expect(state.blockReason).toBe("wait");
  });

  it("legacy payload without status still allows send", () => {
    const state = getFeedbackSendButtonState({
      feedback_request_status: undefined,
      feedback_email_sent: false,
      is_test: false,
    });
    expect(state.visible).toBe(true);
    if (!state.visible) return;
    expect(state.disabled).toBe(false);
    expect(state.label).toBe("Send Feedback Email");
  });
});

describe("buildFeedbackSendConfirms", () => {
  it("returns null when a required confirm is declined", () => {
    const state = getFeedbackSendButtonState(
      job({
        feedback_request_status: status({
          chip: "sent",
          requires_confirm_resend: true,
        }),
        feedback_email_sent: true,
      })
    );
    expect(state.visible).toBe(true);
    if (!state.visible) return;
    expect(buildFeedbackSendConfirms(state, { resend: false })).toBeNull();
  });

  it("builds confirm flags when accepted", () => {
    const state = getFeedbackSendButtonState(
      job({
        is_test: true,
        feedback_request_status: status({
          chip: "ready",
          requires_confirm_test: true,
          requires_confirm_flagged: true,
        }),
      })
    );
    expect(state.visible).toBe(true);
    if (!state.visible) return;
    expect(buildFeedbackSendConfirms(state, { flagged: true, test: true })).toEqual({
      confirm_flagged: true,
      confirm_test: true,
    });
  });
});
