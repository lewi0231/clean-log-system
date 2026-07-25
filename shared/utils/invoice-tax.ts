/**
 * Shared tax-invoice title rules used by InvoiceDocument + PDF attachments.
 *
 * Product default (AU SMB SaaS): GST-registered orgs always title documents
 * "TAX INVOICE". The ATO $82.50 figure is an *obligation* threshold (when you
 * must provide a tax invoice if asked), not a ban on the title for smaller sales.
 */

/**
 * ATO reference: taxable sales of $82.50 or less (inc. GST) do not require a
 * tax invoice unless the customer asks. Kept for help copy — not used for title.
 */
export const TAX_INVOICE_THRESHOLD_AUD = 82.5;

export function resolveInvoiceDocumentTitle(params: {
  gstRegistered: boolean;
}): "TAX INVOICE" | "INVOICE" {
  return params.gstRegistered ? "TAX INVOICE" : "INVOICE";
}

/** Coerce to a finite number; invalid / NaN → fallback. */
export function finiteMoney(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
