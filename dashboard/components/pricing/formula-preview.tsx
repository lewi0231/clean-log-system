"use client";

/**
 * FormulaPreview — Live formula line with actual values
 *
 * Replaces the static `getEquationPreview` with a dynamic preview
 * that shows real numbers from user inputs.
 *
 * @see S2-pricing-tab-redesign.md §4.4
 */

import { Badge } from "@/components/ui/badge";
import {
  buildNumberFieldFormulaLine,
  FORMULA_PREVIEW_DEBOUNCE_MS,
  type FormulaLineResult,
} from "@/lib/pricing-formula-preview";
import type { WorkerPaymentType } from "@/lib/types";
import { memo, useEffect, useMemo, useState } from "react";

export interface FormulaPreviewProps {
  /** Field type (number, boolean, etc.) */
  fieldType: string;
  /** Customer price string from input */
  customerPriceStr: string;
  /** Worker payment value string from input */
  workerPriceStr: string;
  /** Worker payment type from pricing record */
  workerPaymentType: WorkerPaymentType | null;
  /** Currency formatter */
  formatCurrency: (amount: number) => string;
}

/**
 * FormulaPreview displays a live formula line that updates as the user types.
 * Uses debouncing to prevent excessive updates and aria-live for accessibility.
 */
export const FormulaPreview = memo(function FormulaPreview({
  fieldType,
  customerPriceStr,
  workerPriceStr,
  workerPaymentType,
  formatCurrency,
}: FormulaPreviewProps) {
  // Debounced values to prevent excessive re-renders
  const [debouncedCustomer, setDebouncedCustomer] = useState(customerPriceStr);
  const [debouncedWorker, setDebouncedWorker] = useState(workerPriceStr);

  // Debounce customer price changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomer(customerPriceStr);
    }, FORMULA_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [customerPriceStr]);

  // Debounce worker price changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWorker(workerPriceStr);
    }, FORMULA_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [workerPriceStr]);

  // Compute formula result for number fields
  const formulaResult: FormulaLineResult | null = useMemo(() => {
    if (fieldType !== "number") {
      return null;
    }
    return buildNumberFieldFormulaLine({
      customerPriceStr: debouncedCustomer,
      workerPriceStr: debouncedWorker,
      workerPaymentType,
      formatCurrency,
    });
  }, [fieldType, debouncedCustomer, debouncedWorker, workerPaymentType, formatCurrency]);

  // For non-number fields, show a static preview
  if (fieldType !== "number") {
    const staticLine = getStaticPreview(fieldType);
    if (!staticLine) return null;
    return (
      <div className="bg-muted/50 rounded-md p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Formula Preview
          </span>
        </div>
        <p className="text-sm font-mono">{staticLine}</p>
      </div>
    );
  }

  if (!formulaResult) return null;

  return (
    <div className="bg-muted/50 rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Formula Preview
        </span>
        <Badge variant="secondary" className="text-[10px] h-5">
          Live
        </Badge>
      </div>
      {/* aria-live region for screen reader updates (S2 §4.4.5) */}
      <p className="text-sm font-mono" aria-live="polite" aria-atomic="true">
        {formulaResult.line}
      </p>
    </div>
  );
});

/**
 * Get static preview line for non-number field types.
 * These will be enhanced with live values in v1.1.
 */
function getStaticPreview(fieldType: string): string | null {
  switch (fieldType) {
    case "boolean":
      return "Total = base_price (when field is true)";
    case "select":
      return "Total = selected option price";
    case "grouped_breakdown":
      return "Total = Σ (category price × category count)";
    default:
      return null;
  }
}
