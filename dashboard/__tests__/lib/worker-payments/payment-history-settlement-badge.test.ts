import {
  canMarkBatchAsPaidFromStatus,
  settlementBadgeForBatchStatus,
} from "@/lib/worker-payments/payment-history-settlement-badge";
import { describe, expect, it } from "vitest";

describe("settlementBadgeForBatchStatus", () => {
  it("maps completed and paid to Paid", () => {
    expect(settlementBadgeForBatchStatus("completed").key).toBe("paid");
    expect(settlementBadgeForBatchStatus("completed").label).toBe("Paid");
    expect(settlementBadgeForBatchStatus("paid").key).toBe("paid");
  });

  it("maps calculated/approved/processing to Unpaid with tooltip", () => {
    for (const s of ["calculated", "approved", "processing", undefined] as const) {
      const spec = settlementBadgeForBatchStatus(s);
      expect(spec.key).toBe("unpaid");
      expect(spec.label).toBe("Unpaid");
      expect(spec.showUnpaidTooltip).toBe(true);
    }
  });

  it("maps failed to Unpaid destructive with tooltip", () => {
    const spec = settlementBadgeForBatchStatus("failed");
    expect(spec.key).toBe("failed");
    expect(spec.label).toBe("Unpaid");
    expect(spec.showUnpaidTooltip).toBe(true);
  });

  it("maps cancelled to Cancelled", () => {
    const spec = settlementBadgeForBatchStatus("cancelled");
    expect(spec.key).toBe("cancelled");
    expect(spec.label).toBe("Cancelled");
    expect(spec.showUnpaidTooltip).toBe(false);
  });
});

describe("canMarkBatchAsPaidFromStatus", () => {
  it("allows calculated, approved, processing, and undefined", () => {
    expect(canMarkBatchAsPaidFromStatus("calculated")).toBe(true);
    expect(canMarkBatchAsPaidFromStatus("approved")).toBe(true);
    expect(canMarkBatchAsPaidFromStatus("processing")).toBe(true);
    expect(canMarkBatchAsPaidFromStatus(undefined)).toBe(true);
  });

  it("blocks completed, cancelled, paid, failed", () => {
    expect(canMarkBatchAsPaidFromStatus("completed")).toBe(false);
    expect(canMarkBatchAsPaidFromStatus("cancelled")).toBe(false);
    expect(canMarkBatchAsPaidFromStatus("paid")).toBe(false);
    expect(canMarkBatchAsPaidFromStatus("failed")).toBe(false);
  });
});
