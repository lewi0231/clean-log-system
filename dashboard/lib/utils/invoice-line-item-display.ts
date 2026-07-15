/**
 * Shared helpers for invoice line-item description and base-price display.
 * Keep in sync with database/supabase/functions/_utils/invoice-line-item-display.ts
 */

import { DEFAULT_LINE_ITEM_DISPLAY } from "@/lib/constants/invoice-template-defaults";
import type { LineItemDisplayConfig } from "@/lib/types";

export interface LineItemDescriptionSource {
  field_label: string;
  option_value?: string | null;
}

/**
 * Format a line item description from template display settings.
 * When include_option_value is false, only the field label is shown.
 */
export function formatLineItemDescription(
  item: LineItemDescriptionSource,
  config?: Partial<LineItemDisplayConfig> | null
): string {
  const includeOptionValue =
    config?.include_option_value ?? DEFAULT_LINE_ITEM_DISPLAY.include_option_value;
  const optionValue = typeof item.option_value === "string" ? item.option_value.trim() : "";

  if (!includeOptionValue || !optionValue) {
    return item.field_label;
  }

  const format = config?.description_format ?? DEFAULT_LINE_ITEM_DISPLAY.description_format;

  return format
    .replaceAll("{field_label}", item.field_label)
    .replaceAll("{option_value}", optionValue);
}

/**
 * Whether to render base price as its own invoice row.
 * Display-only; the amount remains in job/invoice totals either way.
 */
export function shouldShowBasePriceSeparately(
  basePrice: number,
  config?: Partial<LineItemDisplayConfig> | null
): boolean {
  if (!(basePrice > 0)) return false;

  const show =
    config?.show_base_price_separately ?? DEFAULT_LINE_ITEM_DISPLAY.show_base_price_separately;

  return show;
}
