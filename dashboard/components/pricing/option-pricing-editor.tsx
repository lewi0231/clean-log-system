"use client";

import {
  LocationOverridesMatrix,
  type LocationOverrideRow,
} from "@/components/pricing/location-overrides-matrix";
import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { useOptionPricing } from "@/hooks/use-option-pricing";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import {
  buildScopedPricingMap,
  getPricingScopeSource,
  isEntryForScope,
} from "@/lib/pricing-scope";
import type { OptionPricing } from "@/lib/types";
import type { FieldConfig } from "@clean-log/shared/types";
import { ChevronDown, ChevronRight, DollarSign, Save, Zap } from "lucide-react";
import { useMemo, useState } from "react";

interface OptionPricingEditorProps {
  fieldConfig: FieldConfig;
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
  showBothContexts?: boolean; // When true, shows both customer and worker pricing side-by-side
}

export default function OptionPricingEditor({
  fieldConfig,
  locationHierarchyId = null,
  locationId = null,
  effectiveAt = null,
  pricingContext = "customer",
  showBothContexts = false,
}: OptionPricingEditorProps) {
  const {
    optionPricing: customerPricing,
    loading: customerLoading,
    error: customerError,
    upsertPricing: upsertCustomerPricing,
    deletePricing: deleteCustomerPricing,
    refetch: refetchCustomerPricing,
  } = useOptionPricing(fieldConfig.id, {
    locationHierarchyId,
    locationId,
    effectiveAt,
    pricingContext: "customer",
  });
  const {
    optionPricing: workerPricing,
    loading: workerLoading,
    error: workerError,
    upsertPricing: upsertWorkerPricing,
    deletePricing: deleteWorkerPricing,
    refetch: refetchWorkerPricing,
  } = useOptionPricing(fieldConfig.id, {
    locationHierarchyId,
    locationId,
    effectiveAt,
    pricingContext: "worker",
  });

  // Use the appropriate pricing based on showBothContexts
  const optionPricing = showBothContexts
    ? [...customerPricing, ...workerPricing]
    : pricingContext === "customer"
    ? customerPricing
    : workerPricing;
  const loading = showBothContexts
    ? customerLoading || workerLoading
    : pricingContext === "customer"
    ? customerLoading
    : workerLoading;
  const error = showBothContexts
    ? customerError || workerError
    : pricingContext === "customer"
    ? customerError
    : workerError;
  const upsertPricing = showBothContexts
    ? upsertCustomerPricing
    : pricingContext === "customer"
    ? upsertCustomerPricing
    : upsertWorkerPricing;
  const deletePricing = showBothContexts
    ? deleteCustomerPricing
    : pricingContext === "customer"
    ? deleteCustomerPricing
    : deleteWorkerPricing;
  const { expirationDate } = usePricingScope();
  const { formatCurrency } = useOrganizationCurrency();

  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer?: string; worker?: string }>
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [bulkCustomerPrice, setBulkCustomerPrice] = useState("");
  const [bulkWorkerPrice, setBulkWorkerPrice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const scopeParams = useMemo(
    () => ({ locationId, locationHierarchyId }),
    [locationId, locationHierarchyId]
  );
  const scopeSource = getPricingScopeSource(scopeParams);

  const customerPricingMap = useMemo(() => {
    return buildScopedPricingMap(
      customerPricing,
      scopeParams,
      (record) => record.option_value || null
    );
  }, [customerPricing, scopeParams]);

  const workerPricingMap = useMemo(() => {
    return buildScopedPricingMap(
      workerPricing,
      scopeParams,
      (record) => record.option_value || null
    );
  }, [workerPricing, scopeParams]);

  // Combined map for backward compatibility
  const pricingMap = showBothContexts
    ? customerPricingMap
    : pricingContext === "customer"
    ? customerPricingMap
    : workerPricingMap;

  const options = fieldConfig.options || [];

  const handlePriceChange = (
    optionValue: string,
    value: string,
    type: "customer" | "worker" = "customer"
  ) => {
    setEditingPrices((prev) => ({
      ...prev,
      [optionValue]: {
        ...prev[optionValue],
        [type]: value,
      },
    }));
  };

  const handleSave = async (optionValue: string) => {
    const editing = editingPrices[optionValue];
    if (!editing) return;

    if (showBothContexts) {
      // Save both customer and worker pricing
      const customerPrice = editing.customer
        ? parseFloat(editing.customer)
        : null;
      const workerPrice = editing.worker ? parseFloat(editing.worker) : null;

      if (
        (customerPrice === null || isNaN(customerPrice) || customerPrice < 0) &&
        (workerPrice === null || isNaN(workerPrice) || workerPrice < 0)
      ) {
        return;
      }

      setSaving((prev) => ({ ...prev, [optionValue]: true }));
      try {
        // Save customer pricing if provided
        if (
          customerPrice !== null &&
          !isNaN(customerPrice) &&
          customerPrice >= 0
        ) {
          await upsertCustomerPricing(
            fieldConfig.id,
            optionValue,
            customerPrice,
            {
              locationId,
              locationHierarchyId,
              expirationDate,
              effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
              pricingContext: "customer",
            }
          );
          // Explicitly refetch to ensure UI updates
          await refetchCustomerPricing();
        }

        // Save worker pricing if provided
        if (workerPrice !== null && !isNaN(workerPrice) && workerPrice >= 0) {
          await upsertWorkerPricing(fieldConfig.id, optionValue, workerPrice, {
            locationId,
            locationHierarchyId,
            expirationDate,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "worker",
            workerPaymentRate: workerPrice,
          });
          // Explicitly refetch to ensure UI updates
          await refetchWorkerPricing();
        }

        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      } catch (error) {
        console.error("Failed to save option pricing", error);
      } finally {
        setSaving((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      }
    } else {
      // Original single-context save logic
      const priceValue =
        pricingContext === "customer" ? editing.customer : editing.worker;
      if (!priceValue || priceValue.trim() === "") {
        return;
      }

      const price = parseFloat(priceValue);
      if (isNaN(price) || price < 0) {
        return;
      }

      setSaving((prev) => ({ ...prev, [optionValue]: true }));
      try {
        await upsertPricing(fieldConfig.id, optionValue, price, {
          locationId,
          locationHierarchyId,
          expirationDate,
          effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
          pricingContext,
          ...(pricingContext === "worker" && { workerPaymentRate: price }),
        });
        // Explicitly refetch to ensure UI updates
        const refetch =
          pricingContext === "customer"
            ? refetchCustomerPricing
            : refetchWorkerPricing;
        await refetch();
        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      } catch (error) {
        console.error("Failed to save option pricing", error);
      } finally {
        setSaving((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      }
    }
  };

  const handleSaveAll = async () => {
    if (showBothContexts) {
      // For showBothContexts, handleSave already handles saving both customer and worker
      // This function is mainly for single context mode
      return;
    }

    const changesToSave: Array<{ optionValue: string; price: number }> = [];

    // Validate all changes
    for (const [optionValue, editing] of Object.entries(editingPrices)) {
      if (!editing) continue;

      const priceValue =
        pricingContext === "customer" ? editing.customer : editing.worker;
      if (!priceValue || priceValue.trim() === "") continue;

      const price = parseFloat(priceValue);
      if (isNaN(price) || price < 0) continue;

      const pricingEntry = pricingMap[optionValue];
      const existingPrice =
        pricingContext === "customer"
          ? pricingEntry?.record.customer_price.toString() || ""
          : pricingEntry?.record.worker_payment_rate?.toString() || "";

      // Only save if there's an actual change
      if (priceValue !== existingPrice) {
        changesToSave.push({ optionValue, price });
      }
    }

    if (changesToSave.length === 0) {
      return;
    }

    setSavingAll(true);
    try {
      // Save all changes in parallel
      await Promise.all(
        changesToSave.map(({ optionValue, price }) =>
          upsertPricing(fieldConfig.id, optionValue, price, {
            locationId,
            locationHierarchyId,
            expirationDate,
            pricingContext,
            ...(pricingContext === "worker" && { workerPaymentRate: price }),
          })
        )
      );

      // Clear all editing state
      setEditingPrices({});
    } catch (error) {
      console.error("Failed to save option pricing", error);
    } finally {
      setSavingAll(false);
    }
  };

  const handleApplyBulkPrice = async () => {
    if (showBothContexts) {
      // For showBothContexts, use handleApplyBulkPriceToAll instead
      return;
    }

    const price = parseFloat(
      pricingContext === "customer" ? bulkCustomerPrice : bulkWorkerPrice
    );
    if (isNaN(price) || price < 0) return;

    // Add to editingPrices for unpriced options, then use save all
    const optionsWithoutPrice = options.filter(
      (opt) => pricingMap[opt]?.source !== scopeSource
    );
    const newEditingPrices: Record<
      string,
      { customer?: string; worker?: string }
    > = {};

    for (const optionValue of optionsWithoutPrice) {
      newEditingPrices[optionValue] =
        pricingContext === "customer"
          ? { customer: price.toString() }
          : { worker: price.toString() };
    }

    setEditingPrices((prev) => ({ ...prev, ...newEditingPrices }));

    if (pricingContext === "customer") {
      setBulkCustomerPrice("");
    } else {
      setBulkWorkerPrice("");
    }

    // Use save all mechanism
    setSavingAll(true);
    try {
      await Promise.all(
        optionsWithoutPrice.map((optionValue) =>
          upsertPricing(fieldConfig.id, optionValue, price, {
            locationId,
            locationHierarchyId,
            expirationDate,
            pricingContext,
            ...(pricingContext === "worker" && { workerPaymentRate: price }),
          })
        )
      );
      // Clear only the ones we just added
      setEditingPrices((prev) => {
        const next = { ...prev };
        optionsWithoutPrice.forEach((opt) => delete next[opt]);
        return next;
      });
    } catch (error) {
      console.error("Failed to apply bulk pricing", error);
    } finally {
      setSavingAll(false);
    }
  };

  const handleApplyBulkPriceToAll = async () => {
    if (showBothContexts) {
      const customerPrice = bulkCustomerPrice
        ? parseFloat(bulkCustomerPrice)
        : null;
      const workerPrice = bulkWorkerPrice ? parseFloat(bulkWorkerPrice) : null;

      if (
        (customerPrice === null || isNaN(customerPrice) || customerPrice < 0) &&
        (workerPrice === null || isNaN(workerPrice) || workerPrice < 0)
      ) {
        return;
      }

      setSavingAll(true);
      try {
        // Save all customer pricing first (skip individual refetches to avoid race conditions)
        if (
          customerPrice !== null &&
          !isNaN(customerPrice) &&
          customerPrice >= 0
        ) {
          await Promise.all(
            options.map((optionValue) =>
              upsertCustomerPricing(
                fieldConfig.id,
                optionValue,
                customerPrice,
                {
                  locationId,
                  locationHierarchyId,
                  expirationDate,
                  pricingContext: "customer",
                  skipRefetch: true, // Skip individual refetches
                }
              )
            )
          );
          // Single refetch after all saves complete
          await refetchCustomerPricing();
        }

        // Save all worker pricing
        if (workerPrice !== null && !isNaN(workerPrice) && workerPrice >= 0) {
          await Promise.all(
            options.map((optionValue) =>
              upsertWorkerPricing(fieldConfig.id, optionValue, workerPrice, {
                locationId,
                locationHierarchyId,
                expirationDate,
                pricingContext: "worker",
                workerPaymentRate: workerPrice,
                skipRefetch: true, // Skip individual refetches
              })
            )
          );
          // Single refetch after all saves complete
          await refetchWorkerPricing();
        }
      } catch (error) {
        console.error("Failed to apply bulk pricing", error);
      } finally {
        setSavingAll(false);
        setBulkCustomerPrice("");
        setBulkWorkerPrice("");
      }
    } else {
      // Original single-context logic
      const price = parseFloat(
        pricingContext === "customer" ? bulkCustomerPrice : bulkWorkerPrice
      );
      if (isNaN(price) || price < 0) return;

      setSavingAll(true);
      try {
        await Promise.all(
          options.map((optionValue) =>
            upsertPricing(fieldConfig.id, optionValue, price, {
              locationId,
              locationHierarchyId,
              expirationDate,
              pricingContext,
              ...(pricingContext === "worker" && { workerPaymentRate: price }),
            })
          )
        );
      } catch (error) {
        console.error("Failed to apply bulk pricing", error);
      } finally {
        setSavingAll(false);
        if (pricingContext === "customer") {
          setBulkCustomerPrice("");
        } else {
          setBulkWorkerPrice("");
        }
      }
    }
  };

  // Count options with and without pricing (for the current scope)
  const pricedCount = options.filter((opt) =>
    showBothContexts
      ? customerPricingMap[opt]?.source === scopeSource ||
        workerPricingMap[opt]?.source === scopeSource
      : pricingMap[opt]?.source === scopeSource
  ).length;
  const unpricedCount = options.length - pricedCount;

  // Count pending changes
  const pendingChangesCount = Object.keys(editingPrices).filter(
    (optionValue) => {
      const editing = editingPrices[optionValue];
      if (!editing) return false;

      if (showBothContexts) {
        const customerEntry = customerPricingMap[optionValue];
        const workerEntry = workerPricingMap[optionValue];
        const existingCustomerPrice =
          customerEntry?.record.customer_price.toString() || "";
        const existingWorkerPrice =
          workerEntry?.record.worker_payment_rate?.toString() || "";

        return (
          (editing.customer !== undefined &&
            editing.customer !== existingCustomerPrice) ||
          (editing.worker !== undefined &&
            editing.worker !== existingWorkerPrice)
        );
      } else {
        const priceValue =
          pricingContext === "customer" ? editing.customer : editing.worker;
        if (!priceValue || priceValue.trim() === "") return false;

        const price = parseFloat(priceValue);
        if (isNaN(price) || price < 0) return false;

        const pricingEntry = pricingMap[optionValue];
        const existingPrice =
          pricingContext === "customer"
            ? pricingEntry?.record.customer_price.toString() || ""
            : pricingEntry?.record.worker_payment_rate?.toString() || "";
        return priceValue !== existingPrice;
      }
    }
  ).length;

  if (loading) {
    return <TableSkeleton rows={5} columns={3} />;
  }

  if (error) {
    return (
      <div className="text-center py-4 text-destructive">Error: {error}</div>
    );
  }

  if (options.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No Options</CardTitle>
          <CardDescription>
            This field has no options configured. Add options in Mobile
            Application first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Create a more understandable equation
  const equationPreview = `Total = Sum of (option price × option quantity)`;

  return (
    <div className="space-y-4">
      {/* Equation Preview */}
      <div className="bg-muted/50 rounded-md p-2 text-sm">
        <span className="text-muted-foreground">Equation: </span>
        <span className="font-mono font-medium">{equationPreview}</span>
      </div>

      {/* Save All Changes Button - Show when there are pending changes */}
      {pendingChangesCount > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {pendingChangesCount} unsaved change
                {pendingChangesCount !== 1 ? "s" : ""}
              </span>
            </div>
            <Button size="sm" onClick={handleSaveAll} disabled={savingAll}>
              {savingAll ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-3 w-3" />
                  Save All Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Price Update */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <Label className="font-medium">Bulk Price Update</Label>
          <Badge variant="secondary" className="text-xs">
            {pricedCount}/{options.length} priced
          </Badge>
        </div>
        {showBothContexts ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Customer Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bulkCustomerPrice}
                    onChange={(e) => setBulkCustomerPrice(e.target.value)}
                    className="pl-7 h-9 text-sm"
                    disabled={savingAll}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Worker Payment</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={bulkWorkerPrice}
                    onChange={(e) => setBulkWorkerPrice(e.target.value)}
                    className="pl-7 h-9 text-sm"
                    disabled={savingAll}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleApplyBulkPrice}
                disabled={
                  savingAll ||
                  ((!bulkCustomerPrice ||
                    isNaN(parseFloat(bulkCustomerPrice)) ||
                    parseFloat(bulkCustomerPrice) < 0) &&
                    (!bulkWorkerPrice ||
                      isNaN(parseFloat(bulkWorkerPrice)) ||
                      parseFloat(bulkWorkerPrice) < 0)) ||
                  unpricedCount === 0
                }
              >
                {savingAll ? "Applying..." : `Set Unpriced (${unpricedCount})`}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleApplyBulkPriceToAll}
                disabled={
                  savingAll ||
                  ((!bulkCustomerPrice ||
                    isNaN(parseFloat(bulkCustomerPrice)) ||
                    parseFloat(bulkCustomerPrice) < 0) &&
                    (!bulkWorkerPrice ||
                      isNaN(parseFloat(bulkWorkerPrice)) ||
                      parseFloat(bulkWorkerPrice) < 0))
                }
              >
                {savingAll ? "Applying..." : "Set All"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Apply prices to multiple options at once. Use &quot;Set
              Unpriced&quot; to only fill in missing prices, or &quot;Set
              All&quot; to override existing prices.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative w-32">
              <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={
                  pricingContext === "customer"
                    ? bulkCustomerPrice
                    : bulkWorkerPrice
                }
                onChange={(e) =>
                  pricingContext === "customer"
                    ? setBulkCustomerPrice(e.target.value)
                    : setBulkWorkerPrice(e.target.value)
                }
                className="pl-7 h-9 text-sm"
                disabled={savingAll}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleApplyBulkPrice}
                disabled={
                  savingAll ||
                  (pricingContext === "customer"
                    ? !bulkCustomerPrice ||
                      isNaN(parseFloat(bulkCustomerPrice)) ||
                      parseFloat(bulkCustomerPrice) < 0
                    : !bulkWorkerPrice ||
                      isNaN(parseFloat(bulkWorkerPrice)) ||
                      parseFloat(bulkWorkerPrice) < 0) ||
                  unpricedCount === 0
                }
              >
                {savingAll ? "Applying..." : `Set Unpriced (${unpricedCount})`}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleApplyBulkPriceToAll}
                disabled={
                  savingAll ||
                  (pricingContext === "customer"
                    ? !bulkCustomerPrice ||
                      isNaN(parseFloat(bulkCustomerPrice)) ||
                      parseFloat(bulkCustomerPrice) < 0
                    : !bulkWorkerPrice ||
                      isNaN(parseFloat(bulkWorkerPrice)) ||
                      parseFloat(bulkWorkerPrice) < 0)
                }
              >
                {savingAll ? "Applying..." : "Set All"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Apply prices to multiple options at once. Use &quot;Set
              Unpriced&quot; to only fill in missing prices, or &quot;Set
              All&quot; to override existing prices.
            </p>
          </div>
        )}
      </div>

      {/* Collapsible Individual Options */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary cursor-pointer">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Individual Group Prices
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="space-y-2">
            {options.map((optionValue) => {
              const customerEntry = customerPricingMap[optionValue];
              const workerEntry = workerPricingMap[optionValue];
              const customerPricing = customerEntry?.record;
              const workerPricing = workerEntry?.record;

              // For backward compatibility
              const pricingEntry = showBothContexts
                ? customerEntry
                : pricingContext === "customer"
                ? customerEntry
                : workerEntry;

              const editing = editingPrices[optionValue];
              const currentCustomerPrice =
                editing?.customer !== undefined
                  ? editing.customer
                  : customerPricing
                  ? customerPricing.customer_price.toString()
                  : "";
              const currentWorkerPrice =
                editing?.worker !== undefined
                  ? editing.worker
                  : workerPricing
                  ? workerPricing.worker_payment_rate?.toString() || ""
                  : "";

              const hasCustomerChanges =
                editing?.customer !== undefined &&
                editing.customer !==
                  (customerPricing?.customer_price.toString() || "");
              const hasWorkerChanges =
                editing?.worker !== undefined &&
                editing.worker !==
                  (workerPricing?.worker_payment_rate?.toString() || "");
              const hasChanges = showBothContexts
                ? hasCustomerChanges || hasWorkerChanges
                : pricingContext === "customer"
                ? hasCustomerChanges
                : hasWorkerChanges;

              const isSaving = saving[optionValue] || false;
              const overrides = getOptionOverrides(
                optionPricing,
                optionValue,
                locationId,
                locationHierarchyId
              );
              const previewValue =
                parseFloat(
                  showBothContexts
                    ? currentCustomerPrice
                    : pricingContext === "customer"
                    ? currentCustomerPrice
                    : currentWorkerPrice
                ) || 0;
              const isScopedEntry = isEntryForScope(pricingEntry, scopeSource);

              return (
                <div
                  key={optionValue}
                  className="space-y-2 rounded-lg border p-3"
                >
                  {showBothContexts ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium text-sm flex-1">
                          {optionValue}
                        </Label>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Customer Price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={currentCustomerPrice}
                              onChange={(e) =>
                                handlePriceChange(
                                  optionValue,
                                  e.target.value,
                                  "customer"
                                )
                              }
                              className="pl-7 h-9 text-sm"
                              disabled={isSaving || savingAll}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Worker Payment</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={currentWorkerPrice}
                              onChange={(e) =>
                                handlePriceChange(
                                  optionValue,
                                  e.target.value,
                                  "worker"
                                )
                              }
                              className="pl-7 h-9 text-sm"
                              disabled={isSaving || savingAll}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant={hasChanges ? "default" : "outline"}
                          onClick={() => handleSave(optionValue)}
                          disabled={
                            !hasChanges ||
                            ((!currentCustomerPrice ||
                              isNaN(parseFloat(currentCustomerPrice)) ||
                              parseFloat(currentCustomerPrice) < 0) &&
                              (!currentWorkerPrice ||
                                isNaN(parseFloat(currentWorkerPrice)) ||
                                parseFloat(currentWorkerPrice) < 0)) ||
                            isSaving ||
                            savingAll
                          }
                        >
                          {isSaving ? (
                            "Saving..."
                          ) : isScopedEntry ? (
                            "Update"
                          ) : (
                            <>
                              <Save className="mr-2 h-3 w-3" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1">
                          <Label className="font-medium text-sm">
                            {optionValue}
                          </Label>
                        </div>
                        <div className="w-32">
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={
                                pricingContext === "customer"
                                  ? currentCustomerPrice
                                  : currentWorkerPrice
                              }
                              onChange={(e) =>
                                handlePriceChange(
                                  optionValue,
                                  e.target.value,
                                  pricingContext
                                )
                              }
                              className="pl-7 h-9 text-sm"
                              disabled={isSaving || savingAll}
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={hasChanges ? "default" : "outline"}
                          onClick={() => handleSave(optionValue)}
                          disabled={
                            !hasChanges ||
                            (pricingContext === "customer"
                              ? !currentCustomerPrice ||
                                isNaN(parseFloat(currentCustomerPrice)) ||
                                parseFloat(currentCustomerPrice) < 0
                              : !currentWorkerPrice ||
                                isNaN(parseFloat(currentWorkerPrice)) ||
                                parseFloat(currentWorkerPrice) < 0) ||
                            isSaving ||
                            savingAll
                          }
                        >
                          {isSaving ? (
                            "Saving..."
                          ) : isScopedEntry ? (
                            "Update"
                          ) : (
                            <>
                              <Save className="mr-2 h-3 w-3" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Preview: {formatCurrency(previewValue)}
                      </div>
                    </>
                  )}

                  {/* Only show location overrides when organizational default is selected */}
                  {!locationId &&
                    !locationHierarchyId &&
                    overrides.length > 0 && (
                      <LocationOverridesMatrix
                        rows={overrides}
                        emptyMessage="No overrides for this option"
                        onDelete={async (id) => {
                          setDeletingIds((prev) => new Set(prev).add(id));
                          try {
                            await deletePricing(id);
                          } finally {
                            setDeletingIds((prev) => {
                              const next = new Set(prev);
                              next.delete(id);
                              return next;
                            });
                          }
                        }}
                        deletingIds={deletingIds}
                      />
                    )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function getOptionOverrides(
  pricing: OptionPricing[],
  optionValue: string,
  currentLocationId: string | null,
  currentLocationHierarchyId: string | null
) {
  const now = new Date().toISOString();

  // Get all overrides for this option, excluding the current scope (to avoid duplicates)
  return pricing
    .filter(
      (row) =>
        row.option_value === optionValue &&
        (row.location_id || row.location_hierarchy_id) &&
        // Exclude current scope to avoid showing it as an override
        !(
          (currentLocationId && row.location_id === currentLocationId) ||
          (currentLocationHierarchyId &&
            row.location_hierarchy_id === currentLocationHierarchyId) ||
          (!currentLocationId &&
            !currentLocationHierarchyId &&
            !row.location_id &&
            !row.location_hierarchy_id)
        )
    )
    .map<LocationOverrideRow>((row) => {
      const effectiveAt = row.source_rule?.effective_at;
      const expiresAt = row.source_rule?.expires_at || null;
      const isActive = effectiveAt
        ? effectiveAt <= now && (!expiresAt || expiresAt > now)
        : undefined;
      const isFuture = effectiveAt ? effectiveAt > now : undefined;

      return {
        id: row.id,
        scopeLabel:
          row.location?.name ||
          row.location_node?.name ||
          row.location_id ||
          row.location_hierarchy_id ||
          "Custom scope",
        scopeType: row.location ? "location" : "hierarchy",
        price: row.customer_price,
        workerPayment: row.worker_payment_rate,
        effectiveAt,
        expiresAt,
        isActive,
        isFuture,
      };
    });
}

// formatCurrency is now provided via useOrganizationCurrency hook
