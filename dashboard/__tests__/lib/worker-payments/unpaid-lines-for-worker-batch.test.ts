import { describe, expect, test } from "vitest";
import {
  unpaidLinesForWorkerBatch,
  paidLinesCountForWorkerBatch,
  totalLinesCountForWorkerBatch,
} from "@/lib/worker-payments/unpaid-lines-for-worker-batch";
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

describe("unpaidLinesForWorkerBatch", () => {
  test("returns empty array for undefined payments", () => {
    expect(unpaidLinesForWorkerBatch(undefined, "w1")).toEqual([]);
  });

  test("returns empty array for empty payments", () => {
    expect(unpaidLinesForWorkerBatch([], "w1")).toEqual([]);
  });

  test("filters to only lines for specified worker", () => {
    const payments = [
      makeRow("1", "w1", "calculated"),
      makeRow("2", "w2", "calculated"),
      makeRow("3", "w1", "pending"),
    ];
    const result = unpaidLinesForWorkerBatch(payments, "w1");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
  });

  test("excludes paid lines", () => {
    const payments = [
      makeRow("1", "w1", "calculated"),
      makeRow("2", "w1", "paid"),
      makeRow("3", "w1", "pending"),
    ];
    const result = unpaidLinesForWorkerBatch(payments, "w1");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
  });

  test("excludes cancelled lines", () => {
    const payments = [
      makeRow("1", "w1", "calculated"),
      makeRow("2", "w1", "cancelled"),
      makeRow("3", "w1", "processing"),
    ];
    const result = unpaidLinesForWorkerBatch(payments, "w1");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
  });

  test("includes processing and failed lines", () => {
    const payments = [makeRow("1", "w1", "processing"), makeRow("2", "w1", "failed")];
    const result = unpaidLinesForWorkerBatch(payments, "w1");
    expect(result).toHaveLength(2);
  });
});

describe("paidLinesCountForWorkerBatch", () => {
  test("returns 0 for undefined payments", () => {
    expect(paidLinesCountForWorkerBatch(undefined, "w1")).toBe(0);
  });

  test("counts only paid lines for worker", () => {
    const payments = [
      makeRow("1", "w1", "paid"),
      makeRow("2", "w1", "calculated"),
      makeRow("3", "w2", "paid"),
      makeRow("4", "w1", "paid"),
    ];
    expect(paidLinesCountForWorkerBatch(payments, "w1")).toBe(2);
  });
});

describe("totalLinesCountForWorkerBatch", () => {
  test("returns 0 for undefined payments", () => {
    expect(totalLinesCountForWorkerBatch(undefined, "w1")).toBe(0);
  });

  test("counts all lines for worker regardless of status", () => {
    const payments = [
      makeRow("1", "w1", "paid"),
      makeRow("2", "w1", "calculated"),
      makeRow("3", "w2", "paid"),
      makeRow("4", "w1", "cancelled"),
    ];
    expect(totalLinesCountForWorkerBatch(payments, "w1")).toBe(3);
  });
});
