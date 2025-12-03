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
import { LoadingState } from "@/components/ui/loading-state";
import { useOptionPricing } from "@/hooks/use-option-pricing";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import type { OptionPricing } from "@/lib/types";
import type { FieldConfig } from "@clean-log/shared/types";
import { ChevronDown, ChevronRight, DollarSign, Save, Zap } from "lucide-react";
import { useMemo, useState } from "react";

interface OptionPricingEditorProps {
  fieldConfig: FieldConfig;
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
}

export default function OptionPricingEditor({
  fieldConfig,
  locationHierarchyId = null,
  locationId = null,
  effectiveAt = null,
}: OptionPricingEditorProps) {
  const { optionPricing, loading, error, upsertPricing, deletePricing } =
    useOptionPricing(fieldConfig.id, {
      locationHierarchyId,
      locationId,
      effectiveAt,
    });
  const { expirationDate } = usePricingScope();
  const { formatCurrency } = useOrganizationCurrency();

  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Filter pricing by current scope for main price display
  const scopedPricing = useMemo(() => {
    return optionPricing.filter((p) => {
      // Match current scope (locationId or locationHierarchyId)
      if (locationId) {
        return p.location_id === locationId;
      }
      if (locationHierarchyId) {
        return p.location_hierarchy_id === locationHierarchyId;
      }
      // Default scope: no location or hierarchy
      return !p.location_id && !p.location_hierarchy_id;
    });
  }, [optionPricing, locationId, locationHierarchyId]);

  // Create a map of option_value -> pricing for quick lookup (using scoped pricing)
  const pricingMap = useMemo(() => {
    const map: Record<string, { id: string; customer_price: number }> = {};
    scopedPricing.forEach((p) => {
      map[p.option_value] = {
        id: p.id,
        customer_price: p.customer_price,
      };
    });
    return map;
  }, [scopedPricing]);

  const options = fieldConfig.options || [];

  const handlePriceChange = (optionValue: string, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [optionValue]: value,
    }));
  };

  const handleSave = async (optionValue: string) => {
    const editing = editingPrices[optionValue];
    if (!editing || editing.trim() === "") {
      return;
    }

    const customerPrice = parseFloat(editing);
    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }

    setSaving((prev) => ({ ...prev, [optionValue]: true }));
    try {
      await upsertPricing(fieldConfig.id, optionValue, customerPrice, {
        locationId,
        locationHierarchyId,
        expirationDate,
      });
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
  };

  const handleSaveAll = async () => {
    const changesToSave: Array<{ optionValue: string; price: number }> = [];

    // Validate all changes
    for (const [optionValue, editing] of Object.entries(editingPrices)) {
      if (!editing || editing.trim() === "") continue;

      const customerPrice = parseFloat(editing);
      if (isNaN(customerPrice) || customerPrice < 0) continue;

      const existingPricing = pricingMap[optionValue];
      const existingPrice = existingPricing?.customer_price.toString() || "";

      // Only save if there's an actual change
      if (editing !== existingPrice) {
        changesToSave.push({ optionValue, price: customerPrice });
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
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0) return;

    // Add to editingPrices for unpriced options, then use save all
    const optionsWithoutPrice = options.filter((opt) => !pricingMap[opt]);
    const newEditingPrices: Record<string, string> = {};

    for (const optionValue of optionsWithoutPrice) {
      newEditingPrices[optionValue] = price.toString();
    }

    setEditingPrices((prev) => ({ ...prev, ...newEditingPrices }));
    setBulkPrice("");

    // Use save all mechanism
    setSavingAll(true);
    try {
      await Promise.all(
        optionsWithoutPrice.map((optionValue) =>
          upsertPricing(fieldConfig.id, optionValue, price, {
            locationId,
            locationHierarchyId,
            expirationDate,
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
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0) return;

    // Add all options to editingPrices, then use save all
    const newEditingPrices: Record<string, string> = {};
    for (const optionValue of options) {
      newEditingPrices[optionValue] = price.toString();
    }

    setEditingPrices((prev) => ({ ...prev, ...newEditingPrices }));
    setBulkPrice("");

    // Use save all mechanism
    setSavingAll(true);
    try {
      await Promise.all(
        options.map((optionValue) =>
          upsertPricing(fieldConfig.id, optionValue, price, {
            locationId,
            locationHierarchyId,
            expirationDate,
          })
        )
      );
      setEditingPrices({});
    } catch (error) {
      console.error("Failed to apply bulk pricing", error);
    } finally {
      setSavingAll(false);
    }
  };

  // Count options with and without pricing (in current scope)
  const pricedCount = options.filter((opt) => pricingMap[opt]).length;
  const unpricedCount = options.length - pricedCount;

  // Count pending changes
  const pendingChangesCount = Object.keys(editingPrices).filter(
    (optionValue) => {
      const editing = editingPrices[optionValue];
      if (!editing || editing.trim() === "") return false;

      const customerPrice = parseFloat(editing);
      if (isNaN(customerPrice) || customerPrice < 0) return false;

      const existingPricing = pricingMap[optionValue];
      const existingPrice = existingPricing?.customer_price.toString() || "";
      return editing !== existingPrice;
    }
  ).length;

  if (loading) {
    return <LoadingState message="Loading option pricing..." />;
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

  const equationPreview =
    fieldConfig.field_type === "grouped_breakdown"
      ? "Total = Σ (price_per_group × quantity_per_group)"
      : "Total = Σ (price_per_group × quantity_per_group)";

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

      {/* Bulk Price Setter */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <Label className="font-medium">Quick Set Default Price</Label>
          <Badge variant="secondary" className="text-xs">
            {pricedCount}/{options.length} priced
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-32">
            <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              className="pl-7 h-9 text-sm"
              disabled={savingAll}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyBulkPrice}
            disabled={
              savingAll ||
              !bulkPrice ||
              isNaN(parseFloat(bulkPrice)) ||
              parseFloat(bulkPrice) < 0 ||
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
              !bulkPrice ||
              isNaN(parseFloat(bulkPrice)) ||
              parseFloat(bulkPrice) < 0
            }
          >
            {savingAll ? "Applying..." : "Set All"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Quickly apply a default price to all options. Use &quot;Set
          Unpriced&quot; to only fill in missing prices, or &quot;Set All&quot;
          to override existing prices.
        </p>
      </div>

      {/* Collapsible Individual Options */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary">
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
              const existingPricing = pricingMap[optionValue];
              const editing = editingPrices[optionValue];
              const currentPrice =
                editing !== undefined
                  ? editing
                  : existingPricing
                  ? existingPricing.customer_price.toString()
                  : "";

              const hasChanges =
                editing !== undefined &&
                editing !== (existingPricing?.customer_price.toString() || "");

              const isSaving = saving[optionValue] || false;
              const overrides = getOptionOverrides(
                optionPricing,
                optionValue,
                locationId,
                locationHierarchyId
              );
              const previewValue = parseFloat(currentPrice) || 0;

              return (
                <div
                  key={optionValue}
                  className="space-y-2 rounded-lg border p-3"
                >
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
                          value={currentPrice}
                          onChange={(e) =>
                            handlePriceChange(optionValue, e.target.value)
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
                        !currentPrice ||
                        isNaN(parseFloat(currentPrice)) ||
                        parseFloat(currentPrice) < 0 ||
                        isSaving ||
                        savingAll
                      }
                    >
                      {isSaving ? (
                        "Saving..."
                      ) : existingPricing ? (
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

                  {overrides.length > 0 && (
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
