/**
 * Pricing Formula Preview Helpers
 *
 * Used by FormulaPreview component to generate live formula lines
 * with actual values from user inputs.
 *
 * @see S2-pricing-tab-redesign.md §4.4
 */

import type { WorkerPaymentType } from "./types";

/** Debounce interval for formula preview updates (ms) */
export const FORMULA_PREVIEW_DEBOUNCE_MS = 200;

export interface FormulaLineParams {
  /** Customer price per unit as string from input */
  customerPriceStr: string;
  /** Worker payment value as string from input */
  workerPriceStr: string;
  /** Worker payment type from pricing record */
  workerPaymentType: WorkerPaymentType | null;
  /** Currency formatter function */
  formatCurrency: (amount: number) => string;
}

export interface FormulaLineResult {
  /** The formatted formula line to display */
  line: string;
  /** Whether margin can be computed */
  canShowMargin: boolean;
  /** Margin per unit (only valid when canShowMargin is true) */
  marginPerUnit: number | null;
  /** Margin percentage (only valid when canShowMargin is true and customer > 0) */
  marginPercent: number | null;
  /** Reason margin is not shown (when canShowMargin is false) */
  marginNotShownReason: string | null;
}

/**
 * Parse a price string to a number, handling empty strings and invalid input.
 * Rounds to 2 decimal places to avoid floating-point display issues (§12.1).
 */
export function parseFieldPriceString(value: string): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  // Round to 2 decimal places to avoid floating-point noise
  return Math.round(parsed * 100) / 100;
}

/**
 * Build the formula preview line for a number field.
 *
 * Per S2 §4.4 and §4.11:
 * - Shows margin only when workerPaymentType is "fixed_rate" and both prices are valid
 * - Shows "N/A" explanation for percentage or same_structure worker types
 * - Rounds display to 2 decimal places (§12.1)
 */
export function buildNumberFieldFormulaLine(params: FormulaLineParams): FormulaLineResult {
  const { customerPriceStr, workerPriceStr, workerPaymentType, formatCurrency } = params;

  const customerPrice = parseFieldPriceString(customerPriceStr);
  const workerPrice = parseFieldPriceString(workerPriceStr);

  // Default result for when we can't compute
  const baseResult: FormulaLineResult = {
    line: "",
    canShowMargin: false,
    marginPerUnit: null,
    marginPercent: null,
    marginNotShownReason: null,
  };

  // Handle missing customer price
  if (customerPrice === null) {
    return {
      ...baseResult,
      line: "Enter a customer price to see the formula preview.",
      marginNotShownReason: "Customer price not entered",
    };
  }

  // Check worker payment type for margin eligibility (§4.11)
  if (workerPaymentType === "percentage") {
    const line =
      workerPrice !== null
        ? `Customer ${formatCurrency(customerPrice)} / unit − Worker ${workerPrice}% of customer price`
        : `Customer ${formatCurrency(customerPrice)} / unit`;
    return {
      ...baseResult,
      line,
      marginNotShownReason:
        "Margin not shown when worker payment is a percentage of the customer price.",
    };
  }

  if (workerPaymentType === "same_structure") {
    return {
      ...baseResult,
      line: `Customer ${formatCurrency(customerPrice)} / unit (worker mirrors customer pricing structure)`,
      marginNotShownReason:
        "Margin not shown for same-structure worker payments. The worker receives the same pricing structure as the customer.",
    };
  }

  // Handle missing worker price for fixed_rate
  if (workerPrice === null) {
    return {
      ...baseResult,
      line: `Customer ${formatCurrency(customerPrice)} / unit`,
      marginNotShownReason: "Worker payment not entered",
    };
  }

  // Fixed rate with both prices - can compute margin
  // Round margin to 2 decimal places (§12.1)
  const marginPerUnit = Math.round((customerPrice - workerPrice) * 100) / 100;

  // Compute margin percentage if customer > 0
  let marginPercent: number | null = null;
  if (customerPrice > 0) {
    marginPercent = Math.round((marginPerUnit / customerPrice) * 10000) / 100;
  }

  const marginStr = formatCurrency(Math.abs(marginPerUnit));
  const marginSign = marginPerUnit >= 0 ? "" : "-";
  const line = `Customer ${formatCurrency(customerPrice)} / unit − Worker ${formatCurrency(workerPrice)} / unit = ${marginSign}${marginStr} margin / unit`;

  return {
    line,
    canShowMargin: true,
    marginPerUnit,
    marginPercent,
    marginNotShownReason: null,
  };
}

/**
 * Get the most recent updated_at timestamp from customer and worker rules.
 *
 * Per S2 §4.6.1:
 * - Returns the max of both timestamps
 * - Returns the updatedBy from the winning rule (customer wins ties)
 * - Returns null info if neither rule exists
 */
export interface LastUpdateInfo {
  /** ISO timestamp of the most recent update, or null if no rules */
  updatedAt: string | null;
  /** User ID who made the most recent update, or null */
  updatedBy: string | null;
  /** Which rule provided the winning timestamp */
  source: "customer" | "worker" | null;
}

export function getMaxUpdatedAt(
  customerUpdatedAt: string | null | undefined,
  customerUpdatedBy: string | null | undefined,
  workerUpdatedAt: string | null | undefined,
  workerUpdatedBy: string | null | undefined
): LastUpdateInfo {
  const customerDate = customerUpdatedAt ? new Date(customerUpdatedAt) : null;
  const workerDate = workerUpdatedAt ? new Date(workerUpdatedAt) : null;

  // Neither exists
  if (!customerDate && !workerDate) {
    return { updatedAt: null, updatedBy: null, source: null };
  }

  // Only customer exists
  if (customerDate && !workerDate) {
    return {
      updatedAt: customerUpdatedAt!,
      updatedBy: customerUpdatedBy ?? null,
      source: "customer",
    };
  }

  // Only worker exists
  if (!customerDate && workerDate) {
    return {
      updatedAt: workerUpdatedAt!,
      updatedBy: workerUpdatedBy ?? null,
      source: "worker",
    };
  }

  // Both exist - compare (customer wins ties per §4.6.1)
  if (workerDate! > customerDate!) {
    return {
      updatedAt: workerUpdatedAt!,
      updatedBy: workerUpdatedBy ?? null,
      source: "worker",
    };
  }

  // Customer wins (including ties)
  return {
    updatedAt: customerUpdatedAt!,
    updatedBy: customerUpdatedBy ?? null,
    source: "customer",
  };
}
