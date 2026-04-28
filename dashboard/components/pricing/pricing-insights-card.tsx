"use client";

/**
 * PricingInsightsCard — Margin check + Last update info
 *
 * Shows profitability metrics and last modified metadata for a field.
 *
 * @see S2-pricing-tab-redesign.md §4.5, §4.6
 */

import { ContextualHelp } from "@/components/ui/contextual-help";
import { buildNumberFieldFormulaLine, getMaxUpdatedAt } from "@/lib/pricing-formula-preview";
import type { FieldPricing, WorkerPaymentType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Clock, TrendingUp } from "lucide-react";
import { useMemo } from "react";

export interface PricingInsightsCardProps {
  /** Field type (number, boolean, etc.) */
  fieldType: string;
  /** Customer price string from input */
  customerPriceStr: string;
  /** Worker payment value string from input */
  workerPriceStr: string;
  /** Worker payment type */
  workerPaymentType: WorkerPaymentType | null;
  /** Customer pricing record (for last update) */
  customerPricingRecord: FieldPricing | null;
  /** Worker pricing record (for last update) */
  workerPricingRecord: FieldPricing | null;
  /** Currency formatter */
  formatCurrency: (amount: number) => string;
  /** Callback to navigate to History tab */
  onViewHistory?: () => void;
}

/**
 * Disclaimer text for the profitability check (S2 §2.1).
 */
const MARGIN_DISCLAIMER = `This is an arithmetic comparison of entered rates only. It is not tax, payroll, 
award compliance, or net profit guidance. You are responsible for verifying your own compliance 
with applicable laws and regulations.`;

export function PricingInsightsCard({
  fieldType,
  customerPriceStr,
  workerPriceStr,
  workerPaymentType,
  customerPricingRecord,
  workerPricingRecord,
  formatCurrency,
  onViewHistory,
}: PricingInsightsCardProps) {
  // Compute margin for number fields only
  const marginResult = useMemo(() => {
    if (fieldType !== "number") return null;
    return buildNumberFieldFormulaLine({
      customerPriceStr,
      workerPriceStr,
      workerPaymentType,
      formatCurrency,
    });
  }, [fieldType, customerPriceStr, workerPriceStr, workerPaymentType, formatCurrency]);

  // Compute last update info (S2 §4.6.1)
  const lastUpdateInfo = useMemo(() => {
    return getMaxUpdatedAt(
      customerPricingRecord?.source_rule?.updated_at,
      customerPricingRecord?.source_rule?.updated_by,
      workerPricingRecord?.source_rule?.updated_at,
      workerPricingRecord?.source_rule?.updated_by
    );
  }, [customerPricingRecord, workerPricingRecord]);

  // Format relative time
  const relativeTime = useMemo(() => {
    if (!lastUpdateInfo.updatedAt) return null;
    try {
      return formatDistanceToNow(new Date(lastUpdateInfo.updatedAt), {
        addSuffix: true,
      });
    } catch {
      return null;
    }
  }, [lastUpdateInfo.updatedAt]);

  // Don't render if nothing to show
  const hasMargin = marginResult?.canShowMargin;
  const hasLastUpdate = lastUpdateInfo.updatedAt !== null;
  const hasMarginNotShownReason = marginResult?.marginNotShownReason;

  if (!hasMargin && !hasLastUpdate && !hasMarginNotShownReason) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Profitability Check (S2 §4.5) */}
      {(hasMargin || hasMarginNotShownReason) && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Profitability Check
            </span>
            <ContextualHelp label="How we calculate this">
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Margin per unit</strong> = Customer price − Worker payment
                </p>
                <p>
                  <strong>Margin %</strong> = (Margin / Customer price) × 100
                </p>
                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  {MARGIN_DISCLAIMER}
                </p>
              </div>
            </ContextualHelp>
          </div>

          {hasMargin && marginResult ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div>
                <span className="text-muted-foreground text-xs">Margin/unit: </span>
                <span
                  className={cn(
                    "font-semibold",
                    marginResult.marginPerUnit !== null && marginResult.marginPerUnit < 0
                      ? "text-destructive"
                      : "text-foreground"
                  )}
                >
                  {marginResult.marginPerUnit !== null && marginResult.marginPerUnit < 0 ? "-" : ""}
                  {formatCurrency(Math.abs(marginResult.marginPerUnit ?? 0))}
                </span>
              </div>
              {marginResult.marginPercent !== null && (
                <div>
                  <span className="text-muted-foreground text-xs">Margin %: </span>
                  <span
                    className={cn(
                      "font-semibold",
                      marginResult.marginPercent < 0 ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {marginResult.marginPercent.toFixed(2)}%
                  </span>
                </div>
              )}
              {marginResult.marginPerUnit !== null && marginResult.marginPerUnit < 0 && (
                <p className="w-full text-xs text-destructive">Worker cost exceeds customer rate</p>
              )}
            </div>
          ) : hasMarginNotShownReason ? (
            <p className="text-xs text-muted-foreground">{marginResult?.marginNotShownReason}</p>
          ) : null}
        </div>
      )}

      {/* Last Update (S2 §4.6) */}
      {hasLastUpdate && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last Update
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium" title={lastUpdateInfo.updatedAt ?? undefined}>
                {relativeTime}
              </span>
              {lastUpdateInfo.updatedBy && (
                <span className="text-muted-foreground">
                  {" "}
                  by{" "}
                  {lastUpdateInfo.updatedBy === "Unknown user" ? "Unknown user" : "a team member"}
                </span>
              )}
            </p>
            {onViewHistory && (
              <button
                type="button"
                onClick={onViewHistory}
                className="text-xs text-primary hover:underline"
              >
                View history →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Not saved in this scope yet (S2 §11.4) */}
      {!hasLastUpdate && fieldType === "number" && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last Update
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Not saved in this scope yet</p>
        </div>
      )}
    </div>
  );
}
