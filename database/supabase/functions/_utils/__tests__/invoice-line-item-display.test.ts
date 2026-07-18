import { assertEquals } from "@std/assert";
import {
  buildInvoiceDisplayRows,
  formatLineItemDescription,
  shouldShowBasePriceSeparately,
} from "../invoice-line-item-display.ts";

Deno.test("formatLineItemDescription: includes option when enabled", () => {
  assertEquals(
    formatLineItemDescription(
      { field_label: "Service Type", option_value: "Full Detail" },
      {
        include_option_value: true,
        description_format: "{field_label}: {option_value}",
      }
    ),
    "Service Type: Full Detail"
  );
});

Deno.test("formatLineItemDescription: omits option when disabled", () => {
  assertEquals(
    formatLineItemDescription(
      { field_label: "Service Type", option_value: "Full Detail" },
      {
        include_option_value: false,
        description_format: "{field_label}: {option_value}",
      }
    ),
    "Service Type"
  );
});

Deno.test("formatLineItemDescription: treats whitespace option as missing", () => {
  assertEquals(
    formatLineItemDescription(
      { field_label: "Service Type", option_value: "  " },
      { include_option_value: true }
    ),
    "Service Type"
  );
});

Deno.test("shouldShowBasePriceSeparately: respects toggle and non-finite values", () => {
  assertEquals(shouldShowBasePriceSeparately(40, null), true);
  assertEquals(shouldShowBasePriceSeparately(40, { show_base_price_separately: false }), false);
  assertEquals(shouldShowBasePriceSeparately(0, { show_base_price_separately: true }), false);
  assertEquals(
    shouldShowBasePriceSeparately(Number.NaN, { show_base_price_separately: true }),
    false
  );
});

Deno.test("buildInvoiceDisplayRows: applies display settings", () => {
  const rows = buildInvoiceDisplayRows(
    [
      {
        base_price: 25,
        line_items: [
          {
            field_label: "Service Type",
            option_value: "Full Detail",
            quantity: 1,
            unit_price: 150,
            total: 150,
          },
        ],
      },
    ],
    {
      include_option_value: true,
      description_format: "{option_value}",
      show_base_price_separately: true,
    }
  );

  assertEquals(rows, [
    {
      description: "Base Price",
      quantity: 1,
      unit_price: 25,
      amount: 25,
    },
    {
      description: "Full Detail",
      quantity: 1,
      unit_price: 150,
      amount: 150,
    },
  ]);
});

Deno.test("buildInvoiceDisplayRows: hides base price and option values when off", () => {
  const rows = buildInvoiceDisplayRows(
    [
      {
        base_price: 25,
        line_items: [
          {
            field_label: "Service Type",
            option_value: "Full Detail",
            quantity: 1,
            unit_price: 150,
            total: 150,
          },
        ],
      },
    ],
    {
      include_option_value: false,
      description_format: "{field_label}: {option_value}",
      show_base_price_separately: false,
    }
  );

  assertEquals(rows, [
    {
      description: "Service Type",
      quantity: 1,
      unit_price: 150,
      amount: 150,
    },
  ]);
});

Deno.test("buildInvoiceDisplayRows: handles null/empty inputs safely", () => {
  assertEquals(buildInvoiceDisplayRows(null), []);
  assertEquals(buildInvoiceDisplayRows(undefined), []);
  assertEquals(buildInvoiceDisplayRows([]), []);
  assertEquals(
    buildInvoiceDisplayRows([{ base_price: 10, line_items: null }], {
      show_base_price_separately: true,
    }),
    [
      {
        description: "Base Price",
        quantity: 1,
        unit_price: 10,
        amount: 10,
      },
    ]
  );
});
