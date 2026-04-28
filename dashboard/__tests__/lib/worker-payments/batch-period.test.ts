import { classifyBatchPayPeriod, getBatchAnchorDate } from "@/lib/worker-payments/batch-period";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { describe, expect, it } from "vitest";

function batch(endIso: string): PaymentRecord {
  return {
    id: "b1",
    batch_id: "b1",
    dateRange: { start: "2026-01-01T00:00:00Z", end: endIso },
    jobIds: ["j1"],
    totalPayment: 100,
    workerCount: 1,
    calculatedAt: "2026-01-10T00:00:00Z",
    status: "calculated",
    calculation: {
      success: true,
      calculation: { total_worker_payment: 100, job_calculations: [] },
    },
  };
}

describe("batch-period", () => {
  it("getBatchAnchorDate uses dateRange.end", () => {
    const p = batch("2026-04-10T12:00:00Z");
    expect(getBatchAnchorDate(p).toISOString()).toBe("2026-04-10T12:00:00.000Z");
  });

  it("classifies before current period as arrears", () => {
    const current = {
      from: new Date("2026-04-13T00:00:00.000Z"),
      to: new Date("2026-04-20T23:59:59.999Z"),
    };
    const p = batch("2026-04-12T00:00:00.000Z");
    expect(classifyBatchPayPeriod(p, current)).toBe("arrears");
  });

  it("classifies on/after current start as current", () => {
    const current = {
      from: new Date("2026-04-13T00:00:00.000Z"),
      to: new Date("2026-04-20T23:59:59.999Z"),
    };
    const p = batch("2026-04-15T00:00:00.000Z");
    expect(classifyBatchPayPeriod(p, current)).toBe("current");
  });
});
