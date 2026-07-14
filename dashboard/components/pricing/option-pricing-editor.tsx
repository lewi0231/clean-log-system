"use client";

import {
  PricingScopeControls,
  type ExistingOverrideRow,
  type YardOverrideDraft,
} from "@/components/pricing/pricing-scope-controls";
import {
  PricingScopeSaveDialog,
  type MultiYardOverrideSummaryRow,
} from "@/components/pricing/pricing-scope-save-dialog";
import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { useLocations } from "@/hooks/use-locations";
import { useOptionPricing } from "@/hooks/use-option-pricing";
import { useWorkers } from "@/hooks/use-workers";
import { log } from "@/lib/logger";
import {
  buildOrgDefaultPricingMap,
  buildPreviewPricingMap,
  countLocationOverrides,
  resolveDisplayScope,
} from "@/lib/pricing-scope-display";
import { getScopedPricingOverrides, mergeOverrideRowsByLocation } from "@/lib/pricing-utils";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import type { FieldConfig } from "@clean-log/shared/types";
import { AlertCircle, DollarSign, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

interface OptionPricingEditorProps {
  fieldConfig: FieldConfig;
  /** View-as-of date for fetching rules (display only) */
  effectiveAt?: string | null;
  organizationId: string | null;
  disabled?: boolean;
}

function parsePriceValue(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const price = parseFloat(value);
  if (isNaN(price) || price < 0) return undefined;
  return price;
}

export default function OptionPricingEditor({
  fieldConfig,
  effectiveAt = null,
  organizationId,
  disabled = false,
}: OptionPricingEditorProps) {
  const { showBothContexts, previewLocationId, previewLocationHierarchyId, effectiveDate } =
    usePricingScope();
  const { formatCurrency } = useOrganizationCurrency();
  const { locations } = useLocations();
  const viewDate = effectiveAt ?? effectiveDate;

  const fetchFilters = useMemo(() => ({ effectiveAt: viewDate }), [viewDate]);

  const {
    optionPricing: customerPricing,
    loading: customerLoading,
    error: customerError,
    upsertPricing: upsertCustomerPricing,
    deletePricing: deleteCustomerPricing,
    refetch: refetchCustomerPricing,
  } = useOptionPricing(organizationId, fieldConfig.id, {
    ...fetchFilters,
    pricingContext: "customer",
  });
  const {
    optionPricing: workerPricing,
    loading: workerLoading,
    error: workerError,
    upsertPricing: upsertWorkerPricing,
    deletePricing: deleteWorkerPricing,
    refetch: refetchWorkerPricing,
  } = useOptionPricing(organizationId, fieldConfig.id, {
    ...fetchFilters,
    pricingContext: "worker",
  });

  const loading = customerLoading || workerLoading;
  const error = customerError || workerError;
  const { workers } = useWorkers();
  const hasWorkers = workers && workers.length > 0;

  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer?: string; worker?: string }>
  >({});
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [draftOverridesByOption, setDraftOverridesByOption] = useState<
    Record<string, YardOverrideDraft[]>
  >({});
  const [confirmDialog, setConfirmDialog] = useState<{
    optionValue: string;
    rows: MultiYardOverrideSummaryRow[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const previewParams = useMemo(
    () => ({
      locationId: previewLocationId,
      locationHierarchyId: previewLocationHierarchyId,
    }),
    [previewLocationId, previewLocationHierarchyId]
  );
  const previewActive = !!(previewLocationId || previewLocationHierarchyId);

  const orgCustomerMap = useMemo(
    () => buildOrgDefaultPricingMap(customerPricing, (r) => r.option_value || null),
    [customerPricing]
  );
  const orgWorkerMap = useMemo(
    () => buildOrgDefaultPricingMap(workerPricing, (r) => r.option_value || null),
    [workerPricing]
  );
  const previewCustomerMap = useMemo(
    () =>
      previewActive
        ? buildPreviewPricingMap(customerPricing, previewParams, (r) => r.option_value || null)
        : orgCustomerMap,
    [customerPricing, previewActive, previewParams, orgCustomerMap]
  );
  const previewWorkerMap = useMemo(
    () =>
      previewActive
        ? buildPreviewPricingMap(workerPricing, previewParams, (r) => r.option_value || null)
        : orgWorkerMap,
    [workerPricing, previewActive, previewParams, orgWorkerMap]
  );

  const activeLocations = useMemo(
    () => [...locations].filter((l) => l.active).sort((a, b) => a.name.localeCompare(b.name)),
    [locations]
  );

  const options = fieldConfig.options || [];

  const getOrgDefaultPrices = useCallback(
    (optionValue: string) => {
      const customer = orgCustomerMap[optionValue]?.record;
      const worker = orgWorkerMap[optionValue]?.record;
      return {
        customer: customer?.customer_price?.toString() ?? "",
        worker: worker?.worker_payment_rate?.toString() ?? "",
        customerNum: customer?.customer_price ?? null,
        workerNum: worker?.worker_payment_rate ?? null,
      };
    },
    [orgCustomerMap, orgWorkerMap]
  );

  const getOverrideRowsForOption = useCallback(
    (optionValue: string): ExistingOverrideRow[] => {
      const customerRows = getScopedPricingOverrides(
        customerPricing,
        fieldConfig.id,
        optionValue,
        "customer",
        viewDate
      );
      const workerRows = getScopedPricingOverrides(
        workerPricing,
        fieldConfig.id,
        optionValue,
        "worker",
        viewDate
      );
      const merged = mergeOverrideRowsByLocation(customerRows, workerRows);
      const orgDefault = getOrgDefaultPrices(optionValue);

      return merged
        .filter((row) => row.scopeType === "location")
        .map((row) => {
          const customerRecord = customerPricing.find((p) => p.id === row.customerRuleId);
          const workerRecord = workerPricing.find((p) => p.id === row.workerRuleId);
          const locationId = customerRecord?.location_id ?? workerRecord?.location_id ?? "";

          return {
            locationId,
            locationName: row.scopeLabel,
            customerPrice: row.price,
            workerPrice: row.workerPayment ?? null,
            validUntil: row.expiresAt ? row.expiresAt.split("T")[0] : null,
            customerRuleId: row.customerRuleId,
            workerRuleId: row.workerRuleId,
            isActive: row.isActive,
            revertsToCustomer: orgDefault.customerNum,
          };
        });
    },
    [customerPricing, workerPricing, fieldConfig.id, viewDate, getOrgDefaultPrices]
  );

  const handlePriceChange = (optionValue: string, value: string, type: "customer" | "worker") => {
    setEditingPrices((prev) => ({
      ...prev,
      [optionValue]: { ...prev[optionValue], [type]: value },
    }));
  };

  const handleDiscard = () => {
    setEditingPrices({});
    setDraftOverridesByOption({});
  };

  const handleSaveOrgDefaults = async () => {
    const changesToSave: Array<{
      optionValue: string;
      customerPrice?: number;
      workerPrice?: number;
    }> = [];

    for (const [optionValue, editing] of Object.entries(editingPrices)) {
      if (!editing) continue;
      const org = getOrgDefaultPrices(optionValue);
      const change: {
        optionValue: string;
        customerPrice?: number;
        workerPrice?: number;
      } = { optionValue };

      if (editing.customer !== undefined && editing.customer !== org.customer) {
        const price = parsePriceValue(editing.customer);
        if (price !== undefined) change.customerPrice = price;
      }
      if (editing.worker !== undefined && editing.worker !== org.worker) {
        const price = parsePriceValue(editing.worker);
        if (price !== undefined) change.workerPrice = price;
      }

      if (change.customerPrice !== undefined || change.workerPrice !== undefined) {
        changesToSave.push(change);
      }
    }

    if (changesToSave.length === 0) return;

    startTransition(async () => {
      try {
        const ops = changesToSave.flatMap(({ optionValue, customerPrice, workerPrice }) => {
          const batch = [];
          if (customerPrice !== undefined) {
            batch.push(
              upsertCustomerPricing(fieldConfig.id, optionValue, customerPrice, {
                locationId: null,
                locationHierarchyId: null,
                expirationDate: null,
                pricingContext: "customer",
              })
            );
          }
          if (workerPrice !== undefined) {
            batch.push(
              upsertWorkerPricing(fieldConfig.id, optionValue, workerPrice, {
                locationId: null,
                locationHierarchyId: null,
                expirationDate: null,
                pricingContext: "worker",
                workerPaymentRate: workerPrice,
              })
            );
          }
          return batch;
        });
        await Promise.all(ops);
        await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
        setEditingPrices({});
        toast.success("Pricing saved");
      } catch (err) {
        log.error("Failed to save option pricing", {
          error: err instanceof Error ? err.message : "Unknown error",
          fieldConfigId: fieldConfig.id,
        });
        toast.error("Failed to save pricing");
      }
    });
  };

  const saveOverrideDrafts = async (optionValue: string, drafts: YardOverrideDraft[]) => {
    const org = getOrgDefaultPrices(optionValue);
    for (const draft of drafts) {
      if (draft.validUntil && org.customerNum == null) {
        toast.error(
          `Set an All yards price for ${optionValue} before adding a dated yard override.`
        );
        return;
      }
    }

    setOverrideSaving(true);
    const savedIds: string[] = [];
    try {
      for (const draft of drafts) {
        const customerPrice = parsePriceValue(draft.customerPrice);
        const workerPrice = parsePriceValue(draft.workerPrice);
        if (customerPrice === undefined) {
          throw new Error(`Customer price required for ${draft.locationName}`);
        }

        const expirationDate = draft.validUntil || null;

        if (customerPrice !== undefined) {
          const result = await upsertCustomerPricing(fieldConfig.id, optionValue, customerPrice, {
            locationId: draft.locationId,
            locationHierarchyId: null,
            expirationDate,
            pricingContext: "customer",
            workerPaymentRate: workerPrice ?? null,
          });
          savedIds.push(result.id);
        }

        if (workerPrice !== undefined && hasWorkers) {
          const result = await upsertWorkerPricing(fieldConfig.id, optionValue, workerPrice, {
            locationId: draft.locationId,
            locationHierarchyId: null,
            expirationDate,
            pricingContext: "worker",
            workerPaymentRate: workerPrice,
          });
          savedIds.push(result.id);
        }
      }
      await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
      setDraftOverridesByOption((prev) => ({ ...prev, [optionValue]: [] }));
      toast.success("Yard overrides saved");
    } catch (err) {
      log.error("Failed to save yard overrides", {
        error: err instanceof Error ? err.message : "Unknown error",
        savedIds,
      });
      toast.error("Failed to save yard overrides");
      await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleSaveOverridesClick = (optionValue: string) => {
    const drafts = draftOverridesByOption[optionValue] ?? [];
    if (drafts.length === 0) return;

    const org = getOrgDefaultPrices(optionValue);
    const rows: MultiYardOverrideSummaryRow[] = drafts.map((d) => ({
      yardName: d.locationName,
      customerPrice: parsePriceValue(d.customerPrice) ?? 0,
      workerPrice: parsePriceValue(d.workerPrice) ?? null,
      validUntil: d.validUntil || null,
      revertsToCustomer: org.customerNum,
    }));

    if (drafts.length > 1) {
      setConfirmDialog({ optionValue, rows });
      return;
    }
    void saveOverrideDrafts(optionValue, drafts);
  };

  const pendingChangesCount = useMemo(() => {
    return Object.entries(editingPrices).filter(([optionValue, editing]) => {
      if (!editing) return false;
      const org = getOrgDefaultPrices(optionValue);
      const customerChanged = editing.customer !== undefined && editing.customer !== org.customer;
      const workerChanged = editing.worker !== undefined && editing.worker !== org.worker;
      return customerChanged || workerChanged;
    }).length;
  }, [editingPrices, getOrgDefaultPrices]);

  const hasDraftOverrides = Object.values(draftOverridesByOption).some((d) => d.length > 0);

  const pricedCount = options.filter((opt) => {
    const display = resolveDisplayScope(
      orgCustomerMap[opt],
      orgWorkerMap[opt],
      previewCustomerMap[opt],
      previewWorkerMap[opt],
      countLocationOverrides(
        customerPricing.filter(
          (p) => p.option_value === opt && p.field_config_id === fieldConfig.id && p.location_id
        )
      ),
      previewActive,
      formatCurrency
    );
    return display.hasEffectivePrice;
  }).length;

  const hasUnpricedOptions = pricedCount < options.length;

  if (loading) {
    return <TableSkeleton rows={5} columns={3} />;
  }

  if (error) {
    return <div className="text-center py-4 text-destructive">Error: {error}</div>;
  }

  if (options.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No Options</CardTitle>
          <CardDescription>
            This field has no options configured. Add options in Mobile Application first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <div
          className={`grid ${
            showBothContexts ? "grid-cols-[1fr_140px_140px]" : "grid-cols-[1fr_140px]"
          } gap-2 p-3 bg-muted/50 border-b text-sm font-medium`}
        >
          <div>Option</div>
          <div>
            Customer
            {hasUnpricedOptions && (
              <span className="text-muted-foreground font-normal">
                {" "}
                ({pricedCount}/{options.length})
              </span>
            )}
          </div>
          {showBothContexts && (
            <div>
              Worker
              {hasUnpricedOptions && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({pricedCount}/{options.length})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="divide-y">
          {options.map((optionValue) => {
            const org = getOrgDefaultPrices(optionValue);
            const editing = editingPrices[optionValue];
            const currentCustomerPrice =
              editing?.customer !== undefined ? editing.customer : org.customer;
            const currentWorkerPrice = editing?.worker !== undefined ? editing.worker : org.worker;

            const overrideCount = countLocationOverrides(
              customerPricing.filter(
                (p) =>
                  p.option_value === optionValue &&
                  p.field_config_id === fieldConfig.id &&
                  p.location_id
              )
            );
            const display = resolveDisplayScope(
              orgCustomerMap[optionValue],
              orgWorkerMap[optionValue],
              previewCustomerMap[optionValue],
              previewWorkerMap[optionValue],
              overrideCount,
              previewActive,
              formatCurrency
            );

            const existingOverrides = getOverrideRowsForOption(optionValue);
            const drafts = draftOverridesByOption[optionValue] ?? [];
            const usedLocationIds = new Set([
              ...existingOverrides.map((o) => o.locationId),
              ...drafts.map((d) => d.locationId),
            ]);

            const isExpanded = expandedOption === optionValue;

            return (
              <div key={optionValue} className="p-2 hover:bg-muted/30 transition-colors">
                <div
                  className={`grid ${
                    showBothContexts ? "grid-cols-[1fr_140px_140px]" : "grid-cols-[1fr_140px]"
                  } gap-2 items-center`}
                >
                  <div className="text-sm font-medium truncate" title={optionValue}>
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
                      onChange={(e) => handlePriceChange(optionValue, e.target.value, "customer")}
                      className="pl-6 h-8 text-sm"
                      disabled={isPending || disabled}
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
                        onChange={(e) => handlePriceChange(optionValue, e.target.value, "worker")}
                        className="pl-6 h-8 text-sm"
                        disabled={isPending || disabled || !hasWorkers}
                      />
                    </div>
                  )}
                </div>

                <PricingScopeControls
                  chipVariant={display.chip}
                  inheritedLabel={display.inheritedLabel}
                  overrideCount={overrideCount}
                  expanded={isExpanded}
                  onExpandedChange={(open) => setExpandedOption(open ? optionValue : null)}
                  existingOverrides={existingOverrides}
                  availableLocations={activeLocations}
                  usedLocationIds={usedLocationIds}
                  orgDefaultCustomer={org.customerNum}
                  orgDefaultWorker={org.workerNum}
                  previewActive={previewActive}
                  disabled={disabled}
                  isMobile={isMobile}
                  hasWorkers={hasWorkers}
                  draftOverrides={drafts}
                  onAddDraftOverride={(locationId, locationName) => {
                    const seed = getOrgDefaultPrices(optionValue);
                    setDraftOverridesByOption((prev) => ({
                      ...prev,
                      [optionValue]: [
                        ...(prev[optionValue] ?? []),
                        {
                          draftId: `${locationId}-${Date.now()}`,
                          locationId,
                          locationName,
                          customerPrice: seed.customer || "",
                          workerPrice: seed.worker || "",
                          validUntil: "",
                        },
                      ],
                    }));
                  }}
                  onUpdateDraftOverride={(draftId, patch) => {
                    setDraftOverridesByOption((prev) => ({
                      ...prev,
                      [optionValue]: (prev[optionValue] ?? []).map((d) =>
                        d.draftId === draftId ? { ...d, ...patch } : d
                      ),
                    }));
                  }}
                  onRemoveDraftOverride={(draftId) => {
                    setDraftOverridesByOption((prev) => ({
                      ...prev,
                      [optionValue]: (prev[optionValue] ?? []).filter((d) => d.draftId !== draftId),
                    }));
                  }}
                  onDeleteExistingOverride={async (row) => {
                    try {
                      if (row.customerRuleId) {
                        await deleteCustomerPricing(row.customerRuleId);
                      }
                      if (row.workerRuleId) {
                        await deleteWorkerPricing(row.workerRuleId);
                      }
                      await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
                      toast.success("Override removed");
                    } catch {
                      toast.error("Failed to remove override");
                    }
                  }}
                  onSaveOverrides={() => Promise.resolve(handleSaveOverridesClick(optionValue))}
                  saving={overrideSaving}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showBothContexts && !hasWorkers && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Worker payment fields are disabled. Add workers to your organization to enable worker
            payment settings.
          </p>
        </div>
      )}

      {(pendingChangesCount > 0 || hasDraftOverrides) && (
        <div className="flex items-center justify-end gap-2 p-3 rounded-lg border bg-muted/30">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiscard}
            disabled={isPending || overrideSaving}
            className="gap-1"
          >
            <Undo2 className="h-3 w-3" />
            Discard
          </Button>
          {pendingChangesCount > 0 && (
            <Button
              size="sm"
              onClick={handleSaveOrgDefaults}
              disabled={isPending || overrideSaving}
              className="gap-1 cursor-pointer"
            >
              <Save className="h-3 w-3" />
              {isPending ? "Saving..." : `Save All yards (${pendingChangesCount})`}
            </Button>
          )}
        </div>
      )}

      {confirmDialog && (
        <PricingScopeSaveDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          optionLabel={confirmDialog.optionValue}
          rows={confirmDialog.rows}
          saving={overrideSaving}
          onConfirm={async () => {
            await saveOverrideDrafts(
              confirmDialog.optionValue,
              draftOverridesByOption[confirmDialog.optionValue] ?? []
            );
            setConfirmDialog(null);
          }}
        />
      )}
    </div>
  );
}
