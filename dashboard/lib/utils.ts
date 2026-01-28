import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if conditional pricing rules feature is enabled via environment variable.
 * This controls the UI for conditional/advanced pricing rules (if-then logic),
 * not the base pricing_rule table which is always enabled.
 * The feature flag should be set as NEXT_PUBLIC_CONDITIONAL_PRICING_ENABLED in .env
 */
export function isConditionalPricingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONDITIONAL_PRICING_ENABLED === "true";
}

/**
 * @deprecated Use isConditionalPricingEnabled() instead. This function is kept for backward compatibility.
 * Check if pricing rules feature is enabled via environment variable.
 * The feature flag should be set as NEXT_PUBLIC_PRICING_RULE in .env
 */
export function isPricingRulesEnabled(): boolean {
  // Support both old and new env var names for backward compatibility
  return (
    process.env.NEXT_PUBLIC_PRICING_RULE === "true" ||
    process.env.NEXT_PUBLIC_CONDITIONAL_PRICING_ENABLED === "true"
  );
}

/**
 * Check if the "Send Invoices Immediately" setting is exposed in the UI.
 * When false, the setting is hidden and effectively off. Enable via
 * NEXT_PUBLIC_SEND_INVOICES_IMMEDIATELY_ENABLED=true in .env.
 */
export function isSendInvoicesImmediatelyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEND_INVOICES_IMMEDIATELY_ENABLED === "true";
}
