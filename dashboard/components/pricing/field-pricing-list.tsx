"use client";

import { FieldPricingCard } from "@/components/pricing/field-pricing-card";
import {
  actionLabels,
  operatorLabels,
  serializeCondition,
} from "@/components/pricing/pricing-condition-helpers";
import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { useFieldPricing } from "@/hooks/use-field-pricing";
import { log } from "@/lib/logger";
import { buildScopedPricingMap, getPricingScopeSource, isEntryForScope } from "@/lib/pricing-scope";
import { getLocationOverrides } from "@/lib/pricing-utils";
import type { PricingCondition, PricingType } from "@/lib/types";
import { isPricingRulesEnabled } from "@/lib/utils";
import type { FieldConfig, FieldType } from "@clean-log/shared";
import Link from "next/link";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

// Field types that support pricing (only number and boolean - select and grouped_breakdown use option pricing)
const PRICING_SUPPORTED_TYPES: FieldType[] = ["number", "boolean"];

interface FieldPricingListProps {
  fieldConfigs: FieldConfig[];
  configsLoading: boolean;
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  fieldTypeFilter?: FieldType; // Filter to show only specific field type
  organizationId: string | null;
  /** Callback to navigate to History tab. @see S2 §4.6.4 */
  onNavigateToHistory?: () => void;
}

export default function FieldPricingList({
  fieldConfigs,
  configsLoading,
  locationHierarchyId = null,
  locationId = null,
  effectiveAt = null,
  refreshToken,
  fieldTypeFilter,
  organizationId,
  onNavigateToHistory,
}: FieldPricingListProps) {
  const pricingDebug = process.env.NEXT_PUBLIC_PRICING_DEBUG === "true";
  const { pricingContext, showBothContexts } = usePricingScope();
  const {
    fieldPricing: customerPricing,
    loading: customerLoading,
    error: customerError,
    upsertPricing: upsertCustomerPricing,
    deletePricing: deleteCustomerPricing,
    refetch: refetchCustomerPricing,
  } = useFieldPricing(organizationId, {
    locationHierarchyId,
    locationId,
    effectiveAt,
    refreshToken,
    pricingContext: "customer",
  });
  const {
    fieldPricing: workerPricing,
    loading: workerLoading,
    error: workerError,
    upsertPricing: upsertWorkerPricing,
    deletePricing: deleteWorkerPricing,
    refetch: refetchWorkerPricing,
  } = useFieldPricing(organizationId, {
    locationHierarchyId,
    locationId,
    effectiveAt,
    refreshToken,
    pricingContext: "worker",
  });

  // Note: fieldPricing was previously used but is now replaced by
  // customerPricing and workerPricing arrays used directly in getLocationOverrides
  const pricingLoading = showBothContexts ? customerLoading || workerLoading : customerLoading;
  const pricingError = showBothContexts ? customerError || workerError : customerError;
  const upsertPricing = showBothContexts
    ? upsertCustomerPricing
    : pricingContext === "customer"
      ? upsertCustomerPricing
      : upsertWorkerPricing;
  const { setSelectedFieldId, expirationDate, refreshPricingHistory } = usePricingScope();

  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer?: string; worker?: string }>
  >({});
  const [ruleModalField, setRuleModalField] = useState<FieldConfig | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<ConditionalRuleForm>({
    conditionFieldId: "",
    operator: "greater_than",
    conditionValue: "",
    actionType: "add",
    actionValue: "",
  });

  // Filter to only field types that support pricing
  const pricingFieldConfigs = useMemo(() => {
    let filtered = fieldConfigs.filter((fc) => PRICING_SUPPORTED_TYPES.includes(fc.field_type));
    // If a specific field type filter is provided, apply it
    if (fieldTypeFilter) {
      filtered = filtered.filter((fc) => fc.field_type === fieldTypeFilter);
    }
    return filtered;
  }, [fieldConfigs, fieldTypeFilter]);

  const scopeParams = useMemo(
    () => ({ locationId, locationHierarchyId }),
    [locationId, locationHierarchyId]
  );
  const scopeSource = getPricingScopeSource(scopeParams);

  const customerPricingMap = useMemo(() => {
    return buildScopedPricingMap(
      customerPricing,
      scopeParams,
      (pricing) => pricing.field_config_id || null
    );
  }, [customerPricing, scopeParams]);

  const workerPricingMap = useMemo(() => {
    return buildScopedPricingMap(
      workerPricing,
      scopeParams,
      (pricing) => pricing.field_config_id || null
    );
  }, [workerPricing, scopeParams]);

  // Combined map for backward compatibility
  const pricingMap = showBothContexts
    ? customerPricingMap
    : pricingContext === "customer"
      ? customerPricingMap
      : workerPricingMap;

  const handlePriceChange = (
    fieldConfigId: string,
    value: string,
    type: "customer" | "worker" = "customer"
  ) => {
    setEditingPrices((prev) => ({
      ...prev,
      [fieldConfigId]: {
        ...prev[fieldConfigId],
        [type]: value,
      },
    }));
    setSelectedFieldId(fieldConfigId);
  };

  /**
   * Discard unsaved changes for a field by removing its entry from editingPrices.
   * This causes the UI to revert to customerPricingRecord/workerPricingRecord values.
   * @see S2-pricing-tab-redesign.md §4.7
   */
  const handleDiscard = (fieldConfigId: string) => {
    setEditingPrices((prev) => {
      const next = { ...prev };
      delete next[fieldConfigId];
      return next;
    });
  };

  const handleSave = async (fieldConfig: FieldConfig) => {
    const editing = editingPrices[fieldConfig.id];
    if (!editing) return;

    if (showBothContexts) {
      // Save both customer and worker pricing
      // Allow "0" as a valid price - check for undefined/null/empty, not falsy
      const customerPrice =
        editing.customer !== undefined && editing.customer.trim() !== ""
          ? parseFloat(editing.customer)
          : null;
      const workerPrice =
        editing.worker !== undefined && editing.worker.trim() !== ""
          ? parseFloat(editing.worker)
          : null;

      if (
        (customerPrice === null || isNaN(customerPrice) || customerPrice < 0) &&
        (workerPrice === null || isNaN(workerPrice) || workerPrice < 0)
      ) {
        return;
      }

      try {
        const customerEntry = customerPricingMap[fieldConfig.id];
        const workerEntry = workerPricingMap[fieldConfig.id];

        // Save customer pricing if provided
        if (customerPrice !== null && !isNaN(customerPrice) && customerPrice >= 0) {
          const isLocationOverride = !!(locationId || locationHierarchyId);
          const existingCustomerRule = customerEntry?.record;

          if (pricingDebug) {
            log.debug("[Pricing Debug] Saving customer pricing", {
              fieldConfigId: fieldConfig.id,
              price: customerPrice,
              isLocationOverride,
              locationId,
              locationHierarchyId,
              existingRuleId: existingCustomerRule?.id,
              pricingContext: "customer",
            });
          }

          await upsertCustomerPricing(fieldConfig.id, customerPrice, {
            appliesToFieldType: fieldConfig.field_type,
            pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
            locationHierarchyId,
            locationId,
            conditions: customerEntry?.record?.source_rule?.conditions?.map(serializeCondition),
            expirationDate,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "customer",
          });
          // Explicitly refetch customer pricing to ensure UI updates
          await refetchCustomerPricing();
        }

        // Save worker pricing if provided
        if (workerPrice !== null && !isNaN(workerPrice) && workerPrice >= 0) {
          const isLocationOverride = !!(locationId || locationHierarchyId);
          const existingWorkerRule = workerEntry?.record;

          if (pricingDebug) {
            log.debug("[Pricing Debug] Saving worker pricing", {
              fieldConfigId: fieldConfig.id,
              price: workerPrice,
              isLocationOverride,
              locationId,
              locationHierarchyId,
              existingRuleId: existingWorkerRule?.id,
              pricingContext: "worker",
            });
          }

          await upsertWorkerPricing(fieldConfig.id, workerPrice, {
            appliesToFieldType: fieldConfig.field_type,
            pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
            locationHierarchyId,
            locationId,
            conditions: workerEntry?.record?.source_rule?.conditions?.map(serializeCondition),
            expirationDate,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "worker",
          });
          // Explicitly refetch worker pricing to ensure UI updates
          await refetchWorkerPricing();
        }

        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next[fieldConfig.id];
          return next;
        });
        setSelectedFieldId(fieldConfig.id);
        // Refresh pricing history after save
        refreshPricingHistory();
      } catch (error) {
        log.error("Failed to save pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
          fieldConfigId: fieldConfig.id,
        });
      }
    } else {
      // Original single-context save logic
      const priceValue = pricingContext === "customer" ? editing.customer : editing.worker;
      if (!priceValue || priceValue.trim() === "") {
        return;
      }

      const price = parseFloat(priceValue);
      if (isNaN(price) || price < 0) {
        return;
      }

      try {
        const pricingEntry = pricingMap[fieldConfig.id];
        const existingRule = pricingEntry?.record;
        const isLocationOverride = !!(locationId || locationHierarchyId);

        if (pricingDebug) {
          log.debug("[Pricing Debug] Saving pricing", {
            fieldConfigId: fieldConfig.id,
            price,
            isLocationOverride,
            locationId,
            locationHierarchyId,
            existingRuleId: existingRule?.id,
            pricingContext,
          });
        }

        await upsertPricing(fieldConfig.id, price, {
          appliesToFieldType: fieldConfig.field_type,
          pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
          locationHierarchyId,
          locationId,
          conditions: pricingEntry?.record?.source_rule?.conditions?.map(serializeCondition),
          expirationDate,
          effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
          pricingContext,
        });
        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next[fieldConfig.id];
          return next;
        });
        setSelectedFieldId(fieldConfig.id);
        // Refresh pricing history after save
        refreshPricingHistory();
      } catch (error) {
        log.error("Failed to save pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
          fieldConfigId: fieldConfig.id,
        });
      }
    }
  };

  const openConditionalModal = (field: FieldConfig) => {
    setRuleModalField(field);
    setRuleForm((prev) => ({
      ...prev,
      conditionFieldId: field.id,
    }));
    setRuleError(null);
    setSelectedFieldId(field.id);
  };

  const closeConditionalModal = () => {
    setRuleModalField(null);
    setRuleSaving(false);
    setRuleError(null);
    setRuleForm({
      conditionFieldId: "",
      operator: "greater_than",
      conditionValue: "",
      actionType: "add",
      actionValue: "",
    });
  };

  const handleConditionalRuleSave = async () => {
    if (!ruleModalField) return;

    const pricingEntry = pricingMap[ruleModalField.id];
    const existingPricing = pricingEntry?.record;
    if (!existingPricing) {
      setRuleError("Save a base price before adding rules.");
      return;
    }

    const actionValue = parseFloat(ruleForm.actionValue);
    if (isNaN(actionValue)) {
      setRuleError("Enter a valid adjustment amount.");
      return;
    }

    const existingConditions =
      existingPricing.source_rule.conditions?.map(serializeCondition) ?? [];

    const nextConditions = [
      ...existingConditions,
      {
        condition_field_config_id: ruleForm.conditionFieldId,
        operator: ruleForm.operator,
        condition_value: ruleForm.conditionValue,
        action_type: ruleForm.actionType,
        action_value: actionValue,
        metadata: { created_in_dashboard: true },
        priority: existingConditions.length + 1,
      },
    ];

    setRuleSaving(true);
    setRuleError(null);
    try {
      await upsertPricing(ruleModalField.id, existingPricing.customer_price, {
        appliesToFieldType: ruleModalField.field_type,
        pricingType: existingPricing.pricing_type as PricingType,
        locationHierarchyId,
        locationId,
        conditions: nextConditions,
        effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
        pricingContext,
      });
      closeConditionalModal();
    } catch (error) {
      log.error("Failed to add rule", {
        error: error instanceof Error ? error.message : "Unknown error",
        fieldConfigId: ruleModalField.id,
      });
      setRuleError(error instanceof Error ? error.message : "Failed to add rule.");
    } finally {
      setRuleSaving(false);
    }
  };

  const loading = configsLoading || pricingLoading;

  if (loading) {
    return <TableSkeleton rows={5} columns={4} />;
  }

  if (pricingError) {
    return <div className="text-center py-8 text-destructive">Error: {pricingError}</div>;
  }

  if (pricingFieldConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Fields Available for Pricing</CardTitle>
          <CardDescription>
            To configure field pricing, you need to add number or boolean fields to your mobile app
            forms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/mobile-config" className="cursor-pointer">
              <Button variant="outline" size="sm">
                Go to Mobile App Configuration
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pricingFieldConfigs.map((fieldConfig) => {
          const customerEntry = customerPricingMap[fieldConfig.id];
          const workerEntry = workerPricingMap[fieldConfig.id];
          const customerPricingRecord = customerEntry?.record;
          const workerPricingRecord = workerEntry?.record;

          // For backward compatibility
          const pricingEntry = showBothContexts
            ? customerEntry
            : pricingContext === "customer"
              ? customerEntry
              : workerEntry;
          const scopedPricing = showBothContexts
            ? customerPricingRecord
            : pricingContext === "customer"
              ? customerPricingRecord
              : workerPricingRecord;

          const editing = editingPrices[fieldConfig.id];
          const currentCustomerPrice =
            editing?.customer !== undefined
              ? editing.customer
              : customerPricingRecord
                ? customerPricingRecord.customer_price.toString()
                : "";
          const currentWorkerPrice =
            editing?.worker !== undefined
              ? editing.worker
              : workerPricingRecord
                ? workerPricingRecord.worker_payment_value?.toString() || ""
                : "";

          // Compare as numbers to handle "0" correctly
          const hasCustomerChanges =
            editing?.customer !== undefined &&
            parseFloat(editing.customer || "0") !== (customerPricingRecord?.customer_price ?? 0);
          const hasWorkerChanges =
            editing?.worker !== undefined &&
            parseFloat(editing.worker || "0") !== (workerPricingRecord?.worker_payment_value ?? 0);
          const hasChanges = showBothContexts
            ? hasCustomerChanges || hasWorkerChanges
            : pricingContext === "customer"
              ? hasCustomerChanges
              : hasWorkerChanges;

          // Get location overrides for both customer and worker contexts when showBothContexts is true
          // When showBothContexts, we show customer overrides with customer price and worker payment
          // We also show worker overrides separately with worker price
          // CRITICAL: Filter by pricing_context to ensure worker rules don't appear in customer overrides
          const customerOverrides = getLocationOverrides(
            customerPricing.filter(
              (p) => (p.source_rule?.pricing_context || "customer") === "customer"
            ), // Defensive filter: ensure only customer context rules
            fieldConfig.id,
            locationId,
            locationHierarchyId,
            "customer"
          );
          const workerOverrides = showBothContexts
            ? getLocationOverrides(
                workerPricing.filter((p) => p.source_rule?.pricing_context === "worker"), // Defensive filter: ensure only worker context rules
                fieldConfig.id,
                locationId,
                locationHierarchyId,
                "worker"
              )
            : [];
          // Combine overrides - customer first, then worker
          const overrides = [...customerOverrides, ...workerOverrides];
          const conditions = customerPricingRecord?.source_rule?.conditions ?? [];
          const hasScopedValue = isEntryForScope(pricingEntry, scopeSource);

          const handleDeleteOverride = async (id: string) => {
            try {
              // Find which context this override belongs to
              const override = overrides.find((o) => o.id === id);
              const overrideContext =
                override?.pricingContext ||
                (customerOverrides.some((o) => o.id === id) ? "customer" : "worker");

              if (pricingDebug) {
                log.debug("[Pricing Debug] Deleting location override", {
                  ruleId: id,
                  fieldConfigId: fieldConfig.id,
                  overrideContext,
                  pricingContext,
                  showBothContexts,
                });
              }

              // Use the correct delete function based on the override's context
              if (overrideContext === "customer") {
                await deleteCustomerPricing(id);
              } else {
                await deleteWorkerPricing(id);
              }

              // Refetch both contexts to ensure UI updates immediately
              if (showBothContexts) {
                await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
              } else {
                if (overrideContext === "customer") {
                  await refetchCustomerPricing();
                } else {
                  await refetchWorkerPricing();
                }
              }

              // Refresh pricing history after delete
              refreshPricingHistory();
            } catch (error) {
              log.error("Failed to delete location override", {
                error: error instanceof Error ? error.message : "Unknown error",
                ruleId: id,
                fieldConfigId: fieldConfig.id,
              });
              throw error;
            }
          };

          return (
            <FieldPricingCard
              key={fieldConfig.id}
              fieldConfig={fieldConfig}
              customerPricingRecord={customerPricingRecord ?? null}
              workerPricingRecord={workerPricingRecord ?? null}
              pricingEntry={pricingEntry}
              scopedPricing={scopedPricing ?? null}
              currentCustomerPrice={currentCustomerPrice}
              currentWorkerPrice={currentWorkerPrice}
              hasChanges={hasChanges}
              overrides={overrides}
              conditions={conditions}
              hasScopedValue={hasScopedValue}
              locationId={locationId}
              locationHierarchyId={locationHierarchyId}
              onPriceChange={handlePriceChange}
              onSave={handleSave}
              onDiscard={() => handleDiscard(fieldConfig.id)}
              onNavigateToHistory={onNavigateToHistory}
              onDeleteOverride={handleDeleteOverride}
              onOpenConditionalModal={openConditionalModal}
            />
          );
        })}
      </div>

      {isPricingRulesEnabled() && (
        <ConditionalRuleDialog
          field={ruleModalField}
          fieldOptions={fieldConfigs}
          open={Boolean(ruleModalField)}
          onClose={closeConditionalModal}
          form={ruleForm}
          setForm={setRuleForm}
          onSubmit={handleConditionalRuleSave}
          saving={ruleSaving}
          error={ruleError}
        />
      )}
    </>
  );
}

interface ConditionalRuleForm {
  conditionFieldId: string;
  operator: PricingCondition["operator"];
  conditionValue: string;
  actionType: PricingCondition["action_type"];
  actionValue: string;
}

function ConditionalRuleDialog({
  field,
  fieldOptions,
  open,
  onClose,
  form,
  setForm,
  onSubmit,
  saving,
  error,
}: {
  field: FieldConfig | null;
  fieldOptions: FieldConfig[];
  open: boolean;
  onClose: () => void;
  form: ConditionalRuleForm;
  setForm: Dispatch<SetStateAction<ConditionalRuleForm>>;
  onSubmit: () => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add conditional rule</DialogTitle>
          <DialogDescription>
            Apply adjustments when another field meets specific criteria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Trigger field</Label>
            <Select
              value={form.conditionFieldId || field?.id || ""}
              onValueChange={(value) => setForm((prev) => ({ ...prev, conditionFieldId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a field" />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((fc) => (
                  <SelectItem key={fc.id} value={fc.id}>
                    {fc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Operator</Label>
              <Select
                value={form.operator}
                onValueChange={(value: PricingCondition["operator"]) =>
                  setForm((prev) => ({ ...prev, operator: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose operator" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(operatorLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Compare value</Label>
              <Input
                value={form.conditionValue}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    conditionValue: e.target.value,
                  }))
                }
                placeholder="e.g. 5"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Adjustment</Label>
              <Select
                value={form.actionType}
                onValueChange={(value: PricingCondition["action_type"]) =>
                  setForm((prev) => ({ ...prev, actionType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose action" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adjustment value</Label>
              <Input
                value={form.actionValue}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    actionValue: e.target.value,
                  }))
                }
                placeholder="e.g. 3"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
