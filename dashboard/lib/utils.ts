import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if pricing rules feature is enabled via environment variable.
 * The feature flag should be set as NEXT_PUBLIC_PRICING_RULE in .env
 */
export function isPricingRulesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRICING_RULE === "true";
}
