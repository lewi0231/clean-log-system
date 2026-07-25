/**
 * Shared tax-invoice title rules (ATO-aligned) used by InvoiceDocument + PDF/HTML.
 */

/** AUD total at/above which a GST-registered invoice is titled TAX INVOICE. */
export const TAX_INVOICE_THRESHOLD_AUD = 82.5;

export function resolveInvoiceDocumentTitle(params: {
  gstRegistered: boolean;
  currency: string;
  total: number;
}): "TAX INVOICE" | "INVOICE" {
  const { gstRegistered, currency, total } = params;
  if (!gstRegistered || !Number.isFinite(total)) return "INVOICE";
  if (currency !== "AUD" || total >= TAX_INVOICE_THRESHOLD_AUD) {
    return "TAX INVOICE";
  }
  return "INVOICE";
}

/** Coerce to a finite number; invalid / NaN → fallback. */
export function finiteMoney(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
