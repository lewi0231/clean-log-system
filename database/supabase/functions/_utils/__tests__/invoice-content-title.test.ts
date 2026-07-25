/**
 * Run: deno test --allow-all supabase/functions/_utils/__tests__/invoice-content-title.test.ts
 */
import { assertEquals } from "@std/assert";
import { buildInvoiceDisplayRows } from "../invoice-line-item-display.ts";
import { finiteMoney, resolveInvoiceDocumentTitle } from "../invoice-tax.ts";

Deno.test("TAX INVOICE when GST-registered (any amount)", () => {
  assertEquals(resolveInvoiceDocumentTitle({ gstRegistered: true }), "TAX INVOICE");
});

Deno.test("TAX INVOICE when GST-registered even for small AUD totals", () => {
  // Title is not gated by the ATO $82.50 obligation threshold.
  assertEquals(resolveInvoiceDocumentTitle({ gstRegistered: true }), "TAX INVOICE");
});

Deno.test("INVOICE when not GST-registered", () => {
  assertEquals(resolveInvoiceDocumentTitle({ gstRegistered: false }), "INVOICE");
});

Deno.test("finiteMoney coerces invalid values to fallback", () => {
  assertEquals(finiteMoney(undefined, 0), 0);
  assertEquals(finiteMoney("12.5", 0), 12.5);
  assertEquals(finiteMoney("nope", 3), 3);
  assertEquals(finiteMoney(Number.NaN, 1), 1);
});

Deno.test("PDF line items come from calculation_snapshot job_calculations", () => {
  const rows = buildInvoiceDisplayRows(
    [
      {
        base_price: 50,
        line_items: [
          {
            field_label: "Windows",
            option_value: "Interior",
            quantity: 2,
            unit_price: 10,
            total: 20,
          },
        ],
      },
    ],
    {
      include_option_value: true,
      description_format: "{field_label}: {option_value}",
      show_base_price_separately: true,
    }
  );

  assertEquals(rows, [
    { description: "Base Price", quantity: 1, unit_price: 50, amount: 50 },
    { description: "Windows: Interior", quantity: 2, unit_price: 10, amount: 20 },
  ]);
});
