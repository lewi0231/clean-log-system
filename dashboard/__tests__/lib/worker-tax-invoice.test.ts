import {
  canCancelTaxInvoiceStatus,
  filterActiveTaxInvoiceConflicts,
  isActiveTaxInvoiceStatus,
  normalizeTaxInvoiceJobIds,
  roundTaxInvoiceAmount,
} from "@clean-log/shared/utils/worker-tax-invoice";
import { describe, expect, it } from "vitest";

describe("normalizeTaxInvoiceJobIds", () => {
  it("rejects non-arrays and empty", () => {
    expect(normalizeTaxInvoiceJobIds(null).ok).toBe(false);
    expect(normalizeTaxInvoiceJobIds([]).ok).toBe(false);
  });

  it("rejects blank / non-string ids", () => {
    expect(normalizeTaxInvoiceJobIds(["a", ""]).ok).toBe(false);
    expect(normalizeTaxInvoiceJobIds(["a", 1]).ok).toBe(false);
  });

  it("deduplicates and caps at 100", () => {
    const dup = normalizeTaxInvoiceJobIds(["a", "a", "b"]);
    expect(dup).toEqual({ ok: true, jobIds: ["a", "b"] });

    const tooMany = Array.from({ length: 101 }, (_, i) => `j${i}`);
    expect(normalizeTaxInvoiceJobIds(tooMany).ok).toBe(false);
  });
});

describe("filterActiveTaxInvoiceConflicts", () => {
  const rows = [
    { job_id: "j1", invoice_id: "i1", worker_id: "w1", status: "draft" },
    { job_id: "j2", invoice_id: "i2", worker_id: "w1", status: "rejected" },
    { job_id: "j3", invoice_id: "i3", worker_id: "w2", status: "submitted" },
    { job_id: "j1", invoice_id: "i4", worker_id: "w1", status: "paid" },
  ];

  it("returns active conflicts for the worker", () => {
    expect(filterActiveTaxInvoiceConflicts(rows, "w1")).toEqual(["j1", "j1"]);
  });

  it("excludes current invoice id", () => {
    expect(filterActiveTaxInvoiceConflicts(rows, "w1", "i1")).toEqual(["j1"]);
  });

  it("ignores other workers", () => {
    expect(filterActiveTaxInvoiceConflicts(rows, "w2")).toEqual(["j3"]);
  });
});

describe("status helpers", () => {
  it("classifies active and cancellable statuses", () => {
    expect(isActiveTaxInvoiceStatus("draft")).toBe(true);
    expect(isActiveTaxInvoiceStatus("rejected")).toBe(false);
    expect(canCancelTaxInvoiceStatus("approved")).toBe(true);
    expect(canCancelTaxInvoiceStatus("rejected")).toBe(false);
    expect(canCancelTaxInvoiceStatus("paid")).toBe(false);
  });
});

describe("roundTaxInvoiceAmount", () => {
  it("rounds to cents and treats non-finite as 0", () => {
    expect(roundTaxInvoiceAmount(10.126)).toBe(10.13);
    expect(roundTaxInvoiceAmount(10.124)).toBe(10.12);
    expect(roundTaxInvoiceAmount(Number.NaN)).toBe(0);
    expect(roundTaxInvoiceAmount(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
