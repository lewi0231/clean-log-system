"use client";

import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { useOptionPricing } from "@/hooks/use-option-pricing";
import { useWorkers } from "@/hooks/use-workers";
import { log } from "@/lib/logger";
import {
  buildScopedPricingMap,
  getPricingScopeSource,
} from "@/lib/pricing-scope";
import type { FieldConfig } from "@clean-log/shared/types";
import { AlertCircle, DollarSign, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

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
    refetch: refetchWorkerPricing,
  } = useOptionPricing(fieldConfig.id, {
    locationHierarchyId,
    locationId,
    effectiveAt,
    pricingContext: "worker",
  });

  // Use the appropriate pricing based on showBothContexts
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
  const { expirationDate } = usePricingScope();
  const { workers } = useWorkers();
  const hasWorkers = workers && workers.length > 0;

  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer?: string; worker?: string }>
  >({});
  const [isPending, startTransition] = useTransition();

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

  // Combined map for pricing calculations
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

  // Save all pending changes for both customer and worker contexts
  const handleSaveAllBoth = async () => {
    const changesToSave: Array<{
      optionValue: string;
      customerPrice?: number;
      workerPrice?: number;
    }> = [];

    // Collect all changes
    for (const [optionValue, editing] of Object.entries(editingPrices)) {
      if (!editing) continue;

      const customerEntry = customerPricingMap[optionValue];
      const workerEntry = workerPricingMap[optionValue];

      const existingCustomerPrice =
        customerEntry?.record?.customer_price.toString() || "";
      const existingWorkerPrice =
        workerEntry?.record?.worker_payment_rate?.toString() || "";

      const hasCustomerChange =
        editing.customer !== undefined &&
        editing.customer !== existingCustomerPrice;
      const hasWorkerChange =
        editing.worker !== undefined && editing.worker !== existingWorkerPrice;

      if (!hasCustomerChange && !hasWorkerChange) continue;

      const change: {
        optionValue: string;
        customerPrice?: number;
        workerPrice?: number;
      } = { optionValue };

      if (hasCustomerChange && editing.customer) {
        const price = parseFloat(editing.customer);
        if (!isNaN(price) && price >= 0) {
          change.customerPrice = price;
        }
      }

      if (hasWorkerChange && editing.worker) {
        const price = parseFloat(editing.worker);
        if (!isNaN(price) && price >= 0) {
          change.workerPrice = price;
        }
      }

      if (
        change.customerPrice !== undefined ||
        change.workerPrice !== undefined
      ) {
        changesToSave.push(change);
      }
    }

    if (changesToSave.length === 0) return;

    startTransition(async () => {
      try {
        // Save all changes in parallel
        const promises = changesToSave.flatMap(
          ({ optionValue, customerPrice, workerPrice }) => {
            const ops = [];
            if (customerPrice !== undefined) {
              ops.push(
                upsertCustomerPricing(
                  fieldConfig.id,
                  optionValue,
                  customerPrice,
                  {
                    locationId,
                    locationHierarchyId,
                    expirationDate,
                    pricingContext: "customer",
                  }
                )
              );
            }
            if (workerPrice !== undefined) {
              ops.push(
                upsertWorkerPricing(fieldConfig.id, optionValue, workerPrice, {
                  locationId,
                  locationHierarchyId,
                  expirationDate,
                  pricingContext: "worker",
                  workerPaymentRate: workerPrice,
                })
              );
            }
            return ops;
          }
        );

        await Promise.all(promises);

        // Refetch to get the latest data
        await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);

        // Clear editing state after successful save
        setEditingPrices({});
      } catch (error) {
        log.error("Failed to save all option pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
          fieldConfigId: fieldConfig.id,
        });
      }
    });
  };

  // Count options with and without pricing (for the current scope)
  const pricedCount = options.filter((opt) =>
    showBothContexts
      ? customerPricingMap[opt]?.source === scopeSource ||
        workerPricingMap[opt]?.source === scopeSource
      : pricingMap[opt]?.source === scopeSource
  ).length;

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

  return (
    <div className="space-y-4">
      {/* Compact Inline-Editable Table */}
      <div className="rounded-lg border overflow-hidden">
        {/* Table Header */}
        <div
          className={`grid ${
            showBothContexts
              ? "grid-cols-[1fr_140px_140px]"
              : "grid-cols-[1fr_140px]"
          } gap-2 p-3 bg-muted/50 border-b text-sm font-medium`}
        >
          <div>Option</div>
          <div>Customer Price</div>
          {showBothContexts && <div>Worker Payment</div>}
        </div>

        {/* Table Body - Inline Editable Rows */}
        <div className="divide-y">
          {options.map((optionValue) => {
            const customerEntry = customerPricingMap[optionValue];
            const workerEntry = workerPricingMap[optionValue];
            const customerPricing = customerEntry?.record;
            const workerPricing = workerEntry?.record;

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

            return (
              <div
                key={optionValue}
                className={`grid ${
                  showBothContexts
                    ? "grid-cols-[1fr_140px_140px]"
                    : "grid-cols-[1fr_140px]"
                } gap-2 p-2 items-center hover:bg-muted/30 transition-colors`}
              >
                <div
                  className="text-sm font-medium truncate"
                  title={optionValue}
                >
                  {optionValue}
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={currentCustomerPrice}
                    onChange={(e) =>
                      handlePriceChange(optionValue, e.target.value, "customer")
                    }
                    className="pl-6 h-8 text-sm"
                    disabled={isPending}
                  />
                </div>
                {showBothContexts && (
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={currentWorkerPrice}
                      onChange={(e) =>
                        handlePriceChange(optionValue, e.target.value, "worker")
                      }
                      className="pl-6 h-8 text-sm"
                      disabled={isPending || !hasWorkers}
                      title={
                        !hasWorkers
                          ? "Add workers to your organization to set worker payments"
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Worker Payment Notice */}
      {showBothContexts && !hasWorkers && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Worker payment fields are disabled. Add workers to your organization
            to enable worker payment settings.
          </p>
        </div>
      )}

      {/* Save Button Bar */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
        <Badge variant="secondary" className="text-xs">
          {pricedCount}/{options.length} priced
        </Badge>
        {pendingChangesCount > 0 && (
          <Button
            size="sm"
            onClick={handleSaveAllBoth}
            disabled={isPending}
            className="gap-1 cursor-pointer"
          >
            <Save className="h-3 w-3" />
            {isPending ? "Saving..." : `Save (${pendingChangesCount})`}
          </Button>
        )}
      </div>
    </div>
  );
}
