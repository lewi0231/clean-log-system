/**
 * Run: deno test --allow-all supabase/functions/_utils/__tests__/invoice-content-title.test.ts
 */
import { assertEquals } from "@std/assert";
import {
  finiteMoney,
  resolveInvoiceDocumentTitle,
  TAX_INVOICE_THRESHOLD_AUD,
} from "../invoice-tax.ts";

Deno.test("TAX INVOICE when GST-registered and AUD total at/above threshold", () => {
  assertEquals(
    resolveInvoiceDocumentTitle({
      gstRegistered: true,
      currency: "AUD",
      total: TAX_INVOICE_THRESHOLD_AUD,
    }),
    "TAX INVOICE"
  );
});

Deno.test("INVOICE when GST-registered but AUD total below threshold", () => {
  assertEquals(
    resolveInvoiceDocumentTitle({
      gstRegistered: true,
      currency: "AUD",
      total: TAX_INVOICE_THRESHOLD_AUD - 0.01,
    }),
    "INVOICE"
  );
});

Deno.test("TAX INVOICE for non-AUD when GST-registered", () => {
  assertEquals(
    resolveInvoiceDocumentTitle({ gstRegistered: true, currency: "USD", total: 1 }),
    "TAX INVOICE"
  );
});

Deno.test("INVOICE when not GST-registered", () => {
  assertEquals(
    resolveInvoiceDocumentTitle({ gstRegistered: false, currency: "AUD", total: 500 }),
    "INVOICE"
  );
});

Deno.test("INVOICE when total is NaN", () => {
  assertEquals(
    resolveInvoiceDocumentTitle({ gstRegistered: true, currency: "AUD", total: Number.NaN }),
    "INVOICE"
  );
});

Deno.test("finiteMoney coerces invalid values to fallback", () => {
  assertEquals(finiteMoney(undefined, 0), 0);
  assertEquals(finiteMoney("12.5", 0), 12.5);
  assertEquals(finiteMoney("nope", 3), 3);
  assertEquals(finiteMoney(Number.NaN, 1), 1);
});
