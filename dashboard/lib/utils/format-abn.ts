/**
 * ABN (Australian Business Number) formatting utility.
 * ABNs are 11 digits, displayed as XX XXX XXX XXX.
 */

import { ABN_LENGTH } from "@/lib/constants/invoice-constants";

/**
 * Format an ABN as XX XXX XXX XXX (2-3-3-3) for display.
 * Strips non-digits; if length === 11, returns formatted string.
 * Otherwise returns the original value (or null) to avoid breaking existing data.
 */
export function formatAbn(abn: string | null): string | null {
  if (abn === null || abn === undefined) return null;
  const digits = abn.replace(/\D/g, "");
  if (digits.length !== ABN_LENGTH) return abn;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}
