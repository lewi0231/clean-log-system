import { finiteMoney, resolveInvoiceDocumentTitle } from "@clean-log/shared/utils/invoice-tax";
import { describe, expect, it } from "vitest";

describe("resolveInvoiceDocumentTitle", () => {
  it("uses TAX INVOICE for all amounts when GST-registered", () => {
    expect(resolveInvoiceDocumentTitle({ gstRegistered: true })).toBe("TAX INVOICE");
  });

  it("uses INVOICE when not GST-registered", () => {
    expect(resolveInvoiceDocumentTitle({ gstRegistered: false })).toBe("INVOICE");
  });
});

describe("finiteMoney", () => {
  it("falls back for non-finite values", () => {
    expect(finiteMoney(null, 0)).toBe(0);
    expect(finiteMoney("x", 2)).toBe(2);
  });
});
