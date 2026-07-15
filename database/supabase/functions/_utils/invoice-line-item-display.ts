/**
 * Re-export shared invoice line-item display helpers for Deno edge functions.
 * Canonical implementation lives in shared/utils/invoice-line-item-display.ts
 */

export {
  buildInvoiceDisplayRows,
  DEFAULT_LINE_ITEM_DISPLAY,
  formatLineItemDescription,
  shouldShowBasePriceSeparately,
  type JobCalculationForDisplay,
  type LineItemDescriptionSource,
  type LineItemDisplayConfig,
} from "../../../../shared/utils/invoice-line-item-display.ts";
