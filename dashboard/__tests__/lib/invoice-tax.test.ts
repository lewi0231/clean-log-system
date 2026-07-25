import {
  finiteMoney,
  resolveInvoiceDocumentTitle,
  TAX_INVOICE_THRESHOLD_AUD,
} from "@clean-log/shared/utils/invoice-tax";
import { describe, expect, it } from "vitest";

describe("resolveInvoiceDocumentTitle", () => {
  it("matches ATO threshold boundary", () => {
    expect(
      resolveInvoiceDocumentTitle({
        gstRegistered: true,
        currency: "AUD",
        total: TAX_INVOICE_THRESHOLD_AUD,
      })
    ).toBe("TAX INVOICE");
    expect(
      resolveInvoiceDocumentTitle({
        gstRegistered: true,
        currency: "AUD",
        total: TAX_INVOICE_THRESHOLD_AUD - 0.01,
      })
    ).toBe("INVOICE");
  });
});

describe("finiteMoney", () => {
  it("falls back for non-finite values", () => {
    expect(finiteMoney(null, 0)).toBe(0);
    expect(finiteMoney("x", 2)).toBe(2);
  });
});
