"use client";

/**
 * FormulaPreview — Live formula line with actual values
 *
 * Compact header icon with popover for formula details.
 *
 * @see S2-pricing-tab-redesign.md §4.4
 */

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildNumberFieldFormulaLine,
  FORMULA_PREVIEW_DEBOUNCE_MS,
  type FormulaLineResult,
} from "@/lib/pricing-formula-preview";
import type { WorkerPaymentType } from "@/lib/types";
import { Sigma } from "lucide-react";
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
  /** When true, formula is hidden until user clicks the Σ control */
  collapsible?: boolean;
}

/**
 * FormulaPreviewBody renders the formula content for popovers.
 */
function FormulaPreviewBody({
  fieldType,
  customerPriceStr,
  workerPriceStr,
  workerPaymentType,
  formatCurrency,
}: FormulaPreviewProps) {
  const [debouncedCustomer, setDebouncedCustomer] = useState(customerPriceStr);
  const [debouncedWorker, setDebouncedWorker] = useState(workerPriceStr);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomer(customerPriceStr);
    }, FORMULA_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [customerPriceStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWorker(workerPriceStr);
    }, FORMULA_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [workerPriceStr]);

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

  if (fieldType !== "number") {
    const staticLine = getStaticPreview(fieldType);
    if (!staticLine) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Formula</p>
        <p className="text-sm font-mono">{staticLine}</p>
      </div>
    );
  }

  if (!formulaResult) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Formula</p>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">
          Live
        </Badge>
      </div>
      <p className="text-sm font-mono" aria-live="polite" aria-atomic="true">
        {formulaResult.line}
      </p>
    </div>
  );
}

/**
 * FormulaPreviewIcon — Compact icon button for card headers.
 * Opens a popover with the formula on click.
 */
export const FormulaPreviewIcon = memo(function FormulaPreviewIcon(props: FormulaPreviewProps) {
  const { fieldType } = props;

  const hasPreview =
    fieldType === "number" || fieldType === "boolean" || getStaticPreview(fieldType) !== null;

  if (!hasPreview) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="View pricing formula"
        >
          <Sigma className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72">
        <FormulaPreviewBody {...props} />
      </PopoverContent>
    </Popover>
  );
});

/**
 * FormulaPreview — Legacy component for backward compatibility.
 * Use FormulaPreviewIcon for card headers instead.
 */
export const FormulaPreview = memo(function FormulaPreview(props: FormulaPreviewProps) {
  const { collapsible = false, fieldType } = props;

  const hasPreview =
    fieldType === "number" || fieldType === "boolean" || getStaticPreview(fieldType) !== null;

  if (!hasPreview) return null;

  if (!collapsible) {
    return (
      <div className="bg-muted/50 rounded-md p-3">
        <FormulaPreviewBody {...props} />
      </div>
    );
  }

  return <FormulaPreviewIcon {...props} />;
});

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
