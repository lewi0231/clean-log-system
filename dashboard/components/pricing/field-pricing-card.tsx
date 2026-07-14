"use client";

import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import {
  PricingScopeControls,
  type ExistingOverrideRow,
  type YardOverrideDraft,
} from "@/components/pricing/pricing-scope-controls";
import { ConditionalRuleChips } from "@/components/pricing/conditional-rule-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFieldPricingCardState } from "@/hooks/use-field-pricing-card-state";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { getMaxUpdatedAt } from "@/lib/pricing-formula-preview";
import type { ScopedPricingEntry } from "@/lib/pricing-scope";
import type { ScopeChipVariant } from "@/lib/pricing-scope-display";
import type { FieldPricing, PricingCondition } from "@/lib/types";
import { isPricingRulesEnabled } from "@/lib/utils";
import type { FieldConfig } from "@clean-log/shared";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Save, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { FieldPriceInput } from "./field-price-input";
import { FormulaPreviewIcon } from "./formula-preview";

interface FieldPricingCardProps {
  fieldConfig: FieldConfig;
  customerPricingRecord: FieldPricing | null;
  workerPricingRecord: FieldPricing | null;
  pricingEntry: ScopedPricingEntry<FieldPricing> | undefined;
  scopedPricing: FieldPricing | null;
  currentCustomerPrice: string;
  currentWorkerPrice: string;
  hasChanges: boolean;
  conditions: PricingCondition[];
  hasScopedValue: boolean;
  locationId: string | null;
  locationHierarchyId: string | null;
  onPriceChange: (fieldId: string, value: string, context: "customer" | "worker") => void;
  onSave: (fieldConfig: FieldConfig) => Promise<void>;
  onDiscard?: () => void;
  onNavigateToHistory?: () => void;
  onOpenConditionalModal: (field: FieldConfig) => void;
  /** Yard override controls (org-default scope only) */
  yardScope?: {
    chipVariant: ScopeChipVariant;
    inheritedLabel?: string | null;
    overrideCount: number;
    expanded: boolean;
    onExpandedChange: (open: boolean) => void;
    existingOverrides: ExistingOverrideRow[];
    availableLocations: Array<{ id: string; name: string }>;
    usedLocationIds: Set<string>;
    orgDefaultCustomer: number | null;
    orgDefaultWorker: number | null;
    draftOverrides: YardOverrideDraft[];
    onAddDraftOverride: (locationId: string, locationName: string) => void;
    onUpdateDraftOverride: (
      draftId: string,
      patch: Partial<Pick<YardOverrideDraft, "customerPrice" | "workerPrice" | "validUntil">>
    ) => void;
    onRemoveDraftOverride: (draftId: string) => void;
    onDeleteExistingOverride: (row: ExistingOverrideRow) => Promise<void>;
    onSaveOverrides: () => Promise<void>;
    saving: boolean;
    isMobile: boolean;
    hasWorkers: boolean;
  };
}

export function FieldPricingCard({
  fieldConfig,
  customerPricingRecord,
  workerPricingRecord,
  scopedPricing,
  currentCustomerPrice,
  currentWorkerPrice,
  hasChanges,
  conditions,
  hasScopedValue,
  locationId,
  locationHierarchyId,
  onPriceChange,
  onSave,
  onDiscard,
  onNavigateToHistory,
  onOpenConditionalModal,
  yardScope,
}: FieldPricingCardProps) {
  const { pricingContext, showBothContexts, fieldLabelLookup } = usePricingScope();
  const { isExpanded, setIsExpanded, isSaving, setIsSaving } = useFieldPricingCardState(
    fieldConfig.id
  );
  const { formatCurrency } = useOrganizationCurrency();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(fieldConfig);
    } catch {
      toast.error("Failed to save pricing");
    } finally {
      setIsSaving(false);
    }
  };

  const lastUpdateInfo = useMemo(() => {
    return getMaxUpdatedAt(
      customerPricingRecord?.source_rule?.updated_at,
      customerPricingRecord?.source_rule?.updated_by,
      workerPricingRecord?.source_rule?.updated_at,
      workerPricingRecord?.source_rule?.updated_by
    );
  }, [customerPricingRecord, workerPricingRecord]);

  const relativeTime = useMemo(() => {
    if (!lastUpdateInfo.updatedAt) return null;
    try {
      return formatDistanceToNow(new Date(lastUpdateInfo.updatedAt), { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastUpdateInfo.updatedAt]);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-base">{fieldConfig.label}</CardTitle>
                {(fieldConfig.field_type === "number" || fieldConfig.field_type === "boolean") && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <FormulaPreviewIcon
                      fieldType={fieldConfig.field_type}
                      customerPriceStr={currentCustomerPrice}
                      workerPriceStr={currentWorkerPrice}
                      workerPaymentType={
                        workerPricingRecord?.worker_payment_type ??
                        scopedPricing?.worker_payment_type ??
                        null
                      }
                      formatCurrency={formatCurrency}
                    />
                  </div>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  ({fieldConfig.field_type})
                </span>
              </div>
              <div className="flex items-center gap-3">
                {relativeTime && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToHistory?.();
                          }}
                        >
                          {relativeTime}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>View pricing history</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {showBothContexts ? (
                  <div className="flex items-center gap-3 text-xs">
                    {customerPricingRecord && (
                      <div>
                        <span className="text-muted-foreground">Customer: </span>
                        <span className="font-medium text-primary">
                          {formatCurrency(customerPricingRecord.customer_price)}
                        </span>
                      </div>
                    )}
                    {workerPricingRecord && (
                      <div>
                        <span className="text-muted-foreground">Worker: </span>
                        <span className="font-medium text-primary">
                          {formatCurrency(workerPricingRecord.worker_payment_value || 0)}
                        </span>
                      </div>
                    )}
                    {!customerPricingRecord && !workerPricingRecord && (
                      <span className="text-muted-foreground">No prices set</span>
                    )}
                  </div>
                ) : scopedPricing ? (
                  <span className="text-sm font-medium text-primary">
                    {formatCurrency(
                      pricingContext === "customer"
                        ? scopedPricing.customer_price
                        : scopedPricing.worker_payment_value || 0
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No price set</span>
                )}
              </div>
            </div>
            {fieldConfig.description && (
              <CardDescription className="ml-6">{fieldConfig.description}</CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <FieldPriceInput
              fieldConfig={fieldConfig}
              currentCustomerPrice={currentCustomerPrice}
              currentWorkerPrice={currentWorkerPrice}
              isSaving={isSaving}
              onPriceChange={onPriceChange}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  !hasChanges ||
                  (showBothContexts
                    ? (() => {
                        const customerValid =
                          currentCustomerPrice !== undefined &&
                          currentCustomerPrice !== null &&
                          currentCustomerPrice.trim() !== "" &&
                          !isNaN(parseFloat(currentCustomerPrice)) &&
                          parseFloat(currentCustomerPrice) >= 0;
                        const workerValid =
                          currentWorkerPrice !== undefined &&
                          currentWorkerPrice !== null &&
                          currentWorkerPrice.trim() !== "" &&
                          !isNaN(parseFloat(currentWorkerPrice)) &&
                          parseFloat(currentWorkerPrice) >= 0;
                        return !customerValid && !workerValid;
                      })()
                    : pricingContext === "customer"
                      ? currentCustomerPrice === undefined ||
                        currentCustomerPrice === null ||
                        currentCustomerPrice.trim() === "" ||
                        isNaN(parseFloat(currentCustomerPrice)) ||
                        parseFloat(currentCustomerPrice) < 0
                      : currentWorkerPrice === undefined ||
                        currentWorkerPrice === null ||
                        currentWorkerPrice.trim() === "" ||
                        isNaN(parseFloat(currentWorkerPrice)) ||
                        parseFloat(currentWorkerPrice) < 0)
                }
              >
                {isSaving ? (
                  "Saving..."
                ) : hasScopedValue ? (
                  "Update Rule"
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
              {/* Discard button - S2 §4.7 */}
              {onDiscard && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDiscard}
                  disabled={!hasChanges || isSaving}
                >
                  Discard
                </Button>
              )}
              {isPricingRulesEnabled() && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!scopedPricing}
                        onClick={() => onOpenConditionalModal(fieldConfig)}
                        className="gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Add rule
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Click to create if/then adjustments for this price. Rules appear as chips
                        below the price input.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {yardScope && !locationId && !locationHierarchyId && (
              <PricingScopeControls
                chipVariant={yardScope.chipVariant}
                inheritedLabel={yardScope.inheritedLabel}
                overrideCount={yardScope.overrideCount}
                expanded={yardScope.expanded}
                onExpandedChange={yardScope.onExpandedChange}
                existingOverrides={yardScope.existingOverrides}
                availableLocations={yardScope.availableLocations}
                usedLocationIds={yardScope.usedLocationIds}
                orgDefaultCustomer={yardScope.orgDefaultCustomer}
                orgDefaultWorker={yardScope.orgDefaultWorker}
                previewActive={false}
                hasWorkers={yardScope.hasWorkers}
                draftOverrides={yardScope.draftOverrides}
                onAddDraftOverride={yardScope.onAddDraftOverride}
                onUpdateDraftOverride={yardScope.onUpdateDraftOverride}
                onRemoveDraftOverride={yardScope.onRemoveDraftOverride}
                onDeleteExistingOverride={yardScope.onDeleteExistingOverride}
                onSaveOverrides={yardScope.onSaveOverrides}
                saving={yardScope.saving}
                isMobile={yardScope.isMobile}
              />
            )}

            {conditions.length > 0 && (
              <ConditionalRuleChips conditions={conditions} fieldLabels={fieldLabelLookup} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
