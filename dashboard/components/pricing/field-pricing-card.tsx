"use client";

import { ConditionalRuleChips } from "@/components/pricing/conditional-rule-chips";
import {
  LocationOverridesMatrix,
  type LocationOverrideRow,
} from "@/components/pricing/location-overrides-matrix";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import type { ScopedPricingEntry } from "@/lib/pricing-scope";
import type { FieldPricing, PricingCondition } from "@/lib/types";
import { isPricingRulesEnabled } from "@/lib/utils";
import type { FieldConfig } from "@clean-log/shared";
import { ChevronDown, ChevronRight, Save, Sparkles } from "lucide-react";
import { FieldPriceInput } from "./field-price-input";

interface FieldPricingCardProps {
  fieldConfig: FieldConfig;
  customerPricingRecord: FieldPricing | null;
  workerPricingRecord: FieldPricing | null;
  pricingEntry: ScopedPricingEntry<FieldPricing> | undefined;
  scopedPricing: FieldPricing | null;
  currentCustomerPrice: string;
  currentWorkerPrice: string;
  hasChanges: boolean;
  isSaving: boolean;
  overrides: LocationOverrideRow[];
  conditions: PricingCondition[];
  isExpanded: boolean;
  hasScopedValue: boolean;
  showBothContexts: boolean;
  pricingContext: "customer" | "worker";
  locationId: string | null;
  locationHierarchyId: string | null;
  fieldLabelLookup: Record<string, string>;
  onExpandedChange: (expanded: boolean) => void;
  onPriceChange: (
    fieldId: string,
    value: string,
    context: "customer" | "worker"
  ) => void;
  onSave: (fieldConfig: FieldConfig) => Promise<void>;
  onDeleteOverride: (id: string) => Promise<void>;
  onOpenConditionalModal: (field: FieldConfig) => void;
  deletingIds: Set<string>;
}

const getEquationPreview = (fieldType: string): string => {
  switch (fieldType) {
    case "number":
      return "Total = price_per_unit × quantity";
    case "boolean":
      return "Total = base_price (when field is true)";
    default:
      return "";
  }
};

export function FieldPricingCard({
  fieldConfig,
  customerPricingRecord,
  workerPricingRecord,
  scopedPricing,
  currentCustomerPrice,
  currentWorkerPrice,
  hasChanges,
  isSaving,
  overrides,
  conditions,
  isExpanded,
  hasScopedValue,
  showBothContexts,
  pricingContext,
  locationId,
  locationHierarchyId,
  fieldLabelLookup,
  onExpandedChange,
  onPriceChange,
  onSave,
  onDeleteOverride,
  onOpenConditionalModal,
  deletingIds,
}: FieldPricingCardProps) {
  const { formatCurrency } = useOrganizationCurrency();

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
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
                <span className="text-xs text-muted-foreground font-mono">
                  ({fieldConfig.field_type})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {showBothContexts ? (
                  <div className="flex items-center gap-3 text-xs">
                    {customerPricingRecord && (
                      <div>
                        <span className="text-muted-foreground">
                          Customer:{" "}
                        </span>
                        <span className="font-medium text-primary">
                          {formatCurrency(customerPricingRecord.customer_price)}
                        </span>
                      </div>
                    )}
                    {workerPricingRecord && (
                      <div>
                        <span className="text-muted-foreground">Worker: </span>
                        <span className="font-medium text-primary">
                          {formatCurrency(
                            workerPricingRecord.worker_payment_value || 0
                          )}
                        </span>
                      </div>
                    )}
                    {!customerPricingRecord && !workerPricingRecord && (
                      <span className="text-muted-foreground">
                        No prices set
                      </span>
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
                  <span className="text-xs text-muted-foreground">
                    No price set
                  </span>
                )}
              </div>
            </div>
            {fieldConfig.description && (
              <CardDescription className="ml-6">
                {fieldConfig.description}
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="bg-muted/50 rounded-md p-2 text-sm">
              <span className="text-muted-foreground">Equation: </span>
              <span className="font-mono font-medium">
                {getEquationPreview(fieldConfig.field_type)}
              </span>
            </div>

            <FieldPriceInput
              fieldConfig={fieldConfig}
              currentCustomerPrice={currentCustomerPrice}
              currentWorkerPrice={currentWorkerPrice}
              showBothContexts={showBothContexts}
              pricingContext={pricingContext}
              isSaving={isSaving}
              onPriceChange={onPriceChange}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => onSave(fieldConfig)}
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
                  "Update"
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
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
                        Click to create if/then adjustments for this price.
                        Rules appear as chips below the price input.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Only show location overrides when organizational default is selected and there are overrides */}
            {!locationId && !locationHierarchyId && overrides.length > 0 && (
              <LocationOverridesMatrix
                rows={overrides}
                emptyMessage="No location overrides yet. Select a location in 'Where to Apply Pricing' above, then edit this field's price to create an override."
                onDelete={onDeleteOverride}
                deletingIds={deletingIds}
              />
            )}

            {conditions.length > 0 && (
              <ConditionalRuleChips
                conditions={conditions}
                fieldLabels={fieldLabelLookup}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
