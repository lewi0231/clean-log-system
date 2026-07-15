/**
 * Shared helpers for invoice line-item description and base-price display.
 * Used by dashboard (via @clean-log/shared) and Deno edge functions (relative import).
 */

export const DEFAULT_LINE_ITEM_DISPLAY = {
  include_option_value: true,
  description_format: "{field_label}: {option_value}",
  show_base_price_separately: true,
} as const;

export type LineItemDisplayConfig = {
  include_option_value?: boolean;
  description_format?: string;
  show_base_price_separately?: boolean;
};

export interface LineItemDescriptionSource {
  field_label: string;
  option_value?: string | null;
}

export interface JobCalculationForDisplay {
  base_price?: number;
  line_items?: Array<{
    field_label: string;
    option_value?: string | null;
    quantity: number;
    unit_price: number;
    total: number;
  }> | null;
}

/**
 * Format a line item description from template display settings.
 * When include_option_value is false, only the field label is shown.
 */
export function formatLineItemDescription(
  item: LineItemDescriptionSource,
  config?: LineItemDisplayConfig | null
): string {
  const fieldLabel = typeof item.field_label === "string" ? item.field_label : "";
  const includeOptionValue =
    config?.include_option_value ?? DEFAULT_LINE_ITEM_DISPLAY.include_option_value;
  const optionValue = typeof item.option_value === "string" ? item.option_value.trim() : "";

  if (!includeOptionValue || !optionValue) {
    return fieldLabel;
  }

  const format = config?.description_format ?? DEFAULT_LINE_ITEM_DISPLAY.description_format;

  return format
    .replaceAll("{field_label}", fieldLabel)
    .replaceAll("{option_value}", optionValue);
}

/**
 * Whether to render base price as its own invoice row.
 * Display-only; the amount remains in job/invoice totals either way.
 */
export function shouldShowBasePriceSeparately(
  basePrice: number,
  config?: LineItemDisplayConfig | null
): boolean {
  if (!Number.isFinite(basePrice) || !(basePrice > 0)) return false;

  const show =
    config?.show_base_price_separately ?? DEFAULT_LINE_ITEM_DISPLAY.show_base_price_separately;

  return show;
}

/**
 * Flatten job calculations into printable invoice rows for PDF/HTML.
 */
export function buildInvoiceDisplayRows(
  jobCalculations: JobCalculationForDisplay[] | null | undefined,
  lineItemDisplay: LineItemDisplayConfig | null = DEFAULT_LINE_ITEM_DISPLAY
): Array<{
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}> {
  if (!Array.isArray(jobCalculations) || jobCalculations.length === 0) {
    return [];
  }

  return jobCalculations.flatMap((jobCalc) => {
    const rows: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
    }> = [];
    const basePrice = jobCalc?.base_price ?? 0;

    if (shouldShowBasePriceSeparately(basePrice, lineItemDisplay)) {
      rows.push({
        description: "Base Price",
        quantity: 1,
        unit_price: basePrice,
        amount: basePrice,
      });
    }

    const lineItems = Array.isArray(jobCalc?.line_items) ? jobCalc.line_items : [];

    for (const item of lineItems) {
      rows.push({
        description: formatLineItemDescription(item, lineItemDisplay),
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.total,
      });
    }

    return rows;
  });
}
