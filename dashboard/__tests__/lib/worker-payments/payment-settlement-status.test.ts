import { describe, expect, test } from "vitest";
import {
  getSettlementStatus,
  getWorkerSettlementStatus,
  getSettlementCounts,
  getWorkerSettlementCounts,
} from "@/lib/worker-payments/payment-settlement-status";
import type { BatchWorkerPaymentRow } from "@/lib/worker-payments/export-batch-worker-csv";

function makeRow(id: string, workerId: string, status: string): BatchWorkerPaymentRow {
  return {
    id,
    job_id: `job-${id}`,
    worker_id: workerId,
    amount: 100,
    currency: "AUD",
    status,
    payment_method: null,
    payment_reference: null,
    paid_at: null,
    calculation_details: null,
    notes: null,
    created_at: new Date().toISOString(),
  };
}

describe("getSettlementStatus", () => {
  test('returns "none" for undefined payments', () => {
    expect(getSettlementStatus(undefined)).toBe("none");
  });

  test('returns "none" for empty payments', () => {
    expect(getSettlementStatus([])).toBe("none");
  });

  test('returns "none" when no lines are paid', () => {
    const payments = [makeRow("1", "w1", "calculated"), makeRow("2", "w1", "pending")];
    expect(getSettlementStatus(payments)).toBe("none");
  });

  test('returns "complete" when all lines are paid', () => {
    const payments = [makeRow("1", "w1", "paid"), makeRow("2", "w1", "paid")];
    expect(getSettlementStatus(payments)).toBe("complete");
  });

  test('returns "partial" when some but not all lines are paid', () => {
    const payments = [
      makeRow("1", "w1", "paid"),
      makeRow("2", "w1", "calculated"),
      makeRow("3", "w1", "paid"),
    ];
    expect(getSettlementStatus(payments)).toBe("partial");
  });
});

describe("getWorkerSettlementStatus", () => {
  test("filters to worker before calculating status", () => {
    const payments = [
      makeRow("1", "w1", "paid"),
      makeRow("2", "w2", "calculated"),
      makeRow("3", "w1", "paid"),
    ];
    expect(getWorkerSettlementStatus(payments, "w1")).toBe("complete");
    expect(getWorkerSettlementStatus(payments, "w2")).toBe("none");
  });

  test('returns "partial" for worker with mixed status', () => {
    const payments = [makeRow("1", "w1", "paid"), makeRow("2", "w1", "calculated")];
    expect(getWorkerSettlementStatus(payments, "w1")).toBe("partial");
  });
});

describe("getSettlementCounts", () => {
  test("returns zero counts for undefined", () => {
    expect(getSettlementCounts(undefined)).toEqual({ paid: 0, total: 0 });
  });

  test("counts paid and total correctly", () => {
    const payments = [
      makeRow("1", "w1", "paid"),
      makeRow("2", "w1", "calculated"),
      makeRow("3", "w1", "paid"),
      makeRow("4", "w1", "pending"),
    ];
    expect(getSettlementCounts(payments)).toEqual({ paid: 2, total: 4 });
  });
});

describe("getWorkerSettlementCounts", () => {
  test("filters to worker before counting", () => {
    const payments = [
      makeRow("1", "w1", "paid"),
      makeRow("2", "w2", "paid"),
      makeRow("3", "w1", "calculated"),
    ];
    expect(getWorkerSettlementCounts(payments, "w1")).toEqual({
      paid: 1,
      total: 2,
    });
    expect(getWorkerSettlementCounts(payments, "w2")).toEqual({
      paid: 1,
      total: 1,
    });
  });
});
