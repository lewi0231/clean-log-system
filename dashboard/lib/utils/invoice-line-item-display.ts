/**
 * Re-export shared invoice line-item display helpers.
 * Canonical implementation: @clean-log/shared/utils/invoice-line-item-display
 */

export {
  buildInvoiceDisplayRows,
  DEFAULT_LINE_ITEM_DISPLAY,
  formatLineItemDescription,
  shouldShowBasePriceSeparately,
  type JobCalculationForDisplay,
  type LineItemDescriptionSource,
  type LineItemDisplayConfig,
} from "@clean-log/shared/utils/invoice-line-item-display";
