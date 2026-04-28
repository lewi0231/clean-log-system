import {
  buildWorkerTotalsCsv,
  escapeCsvField,
  getCurrencyMinorUnitFactor,
  reconcileBatchTotal,
  rollupByWorkerId,
  type BatchWorkerPaymentRow,
} from "@/lib/worker-payments/export-batch-worker-csv";
import { describe, expect, it } from "vitest";

function row(
  partial: Pick<BatchWorkerPaymentRow, "id" | "job_id" | "worker_id" | "amount" | "currency"> &
    Partial<BatchWorkerPaymentRow>
): BatchWorkerPaymentRow {
  return {
    status: "calculated",
    payment_method: null,
    payment_reference: null,
    paid_at: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    calculation_details: {},
    ...partial,
  };
}

describe("reconcileBatchTotal", () => {
  it("passes when total matches line sum (AUD, 2dp)", () => {
    const { ok, deltaMinorUnits } = reconcileBatchTotal(
      100.5,
      [{ amount: 50.25 }, { amount: 50.25 }],
      "AUD"
    );
    expect(ok).toBe(true);
    expect(deltaMinorUnits).toBe(0);
  });

  it("fails on 2¢ drift (AUD)", () => {
    const { ok } = reconcileBatchTotal(100, [{ amount: 100.02 }], "AUD");
    expect(ok).toBe(false);
  });

  it("uses minor units: JPY allows 1 yen tolerance", () => {
    const { ok } = reconcileBatchTotal(100, [{ amount: 100 }], "JPY");
    expect(ok).toBe(true);
  });

  it("JPY: 2 yen drift fails", () => {
    const { ok } = reconcileBatchTotal(100, [{ amount: 98 }], "JPY");
    expect(ok).toBe(false);
  });

  it("exposes factor 1 for JPY", () => {
    expect(getCurrencyMinorUnitFactor("JPY")).toBe(1);
  });
});

describe("rollupByWorkerId", () => {
  it("merges two jobs for the same worker", () => {
    const rows = [
      row({
        id: "1",
        job_id: "j1",
        worker_id: "w1",
        amount: 40,
        currency: "AUD",
        calculation_details: { worker_split: { hours_worked: 2 } },
      }),
      row({
        id: "2",
        job_id: "j2",
        worker_id: "w1",
        amount: 60,
        currency: "AUD",
        calculation_details: { worker_split: { hours_worked: 3 } },
      }),
    ];
    const map = rollupByWorkerId(rows);
    const r = map.get("w1");
    expect(r).toBeDefined();
    expect(r!.total).toBe(100);
    expect(r!.jobIds.size).toBe(2);
    expect(r!.hoursWorked).toBe(5);
  });
});

describe("escapeCsvField", () => {
  it("escapes fields with comma", () => {
    expect(escapeCsvField("a,b")).toBe(`"a,b"`);
  });
  it("doubles internal quotes", () => {
    expect(escapeCsvField(`say "hi"`)).toBe(`"say ""hi"""`);
  });
  it("quotes name starting with = (formula risk)", () => {
    expect(escapeCsvField("=EVIL")).toBe(`"=EVIL"`);
  });
  it("quotes + - @ at start", () => {
    expect(escapeCsvField("+1")).toMatch(/^"/);
    expect(escapeCsvField("-1")).toMatch(/^"/);
    expect(escapeCsvField("@ref")).toMatch(/^"/);
  });
  it("allows plain names", () => {
    expect(escapeCsvField("Jane")).toBe("Jane");
  });
});

describe("buildWorkerTotalsCsv", () => {
  it("emits # header lines, data rows, and RECONCILIATION line", () => {
    const s = buildWorkerTotalsCsv({
      batchId: "b-1",
      organizationId: "o-1",
      currency: "AUD",
      calculatedAt: "2024-01-15T00:00:00Z",
      exportGeneratedAt: "2024-01-20T00:00:00Z",
      dataRows: [
        {
          batch_id: "b-1",
          organization_id: "o-1",
          currency: "AUD",
          worker_id: "w-1",
          worker_name: "Ava",
          total_for_batch: "100.00",
          job_count_in_batch: "1",
          hours_worked: "0",
          split_mode: "calculated",
          calculated_at: "2024-01-15T00:00:00Z",
          export_generated_at: "2024-01-20T00:00:00Z",
        },
      ],
      reconciliation: { tBatch: 100, sWorkers: 100, ok: true },
    });
    expect(s).toContain("# Tally Runner");
    expect(s).toContain("# Batch: b-1");
    expect(s).toContain("DISCLAIMER:");
    expect(s).toMatch(/# RECONCILIATION: T_batch=100 S_workers=100 OK/);
    expect(s).toContain("worker_id");
    expect(s).toContain("w-1");
  });
});
