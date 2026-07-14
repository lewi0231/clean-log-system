"use client";

import { FieldPricingCard } from "@/components/pricing/field-pricing-card";
import type {
  YardOverrideDraft,
  ExistingOverrideRow,
} from "@/components/pricing/pricing-scope-controls";
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
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkers } from "@/hooks/use-workers";
import { log } from "@/lib/logger";
import { buildScopedPricingMap, getPricingScopeSource, isEntryForScope } from "@/lib/pricing-scope";
import {
  buildOrgDefaultPricingMap,
  countLocationOverrides,
  resolveDisplayScope,
} from "@/lib/pricing-scope-display";
import { getScopedPricingOverrides, mergeOverrideRowsByLocation } from "@/lib/pricing-utils";
import type { PricingCondition, PricingType } from "@/lib/types";
import { isPricingRulesEnabled } from "@/lib/utils";
import type { FieldConfig, FieldType } from "@clean-log/shared";
import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

// Field types that support pricing (only number and boolean - select and grouped_breakdown use option pricing)
const PRICING_SUPPORTED_TYPES: FieldType[] = ["number", "boolean"];

function parsePriceValue(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const price = parseFloat(value);
  if (isNaN(price) || price < 0) return undefined;
  return price;
}

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
  const { formatCurrency } = useOrganizationCurrency();
  const { locations } = useLocations();
  const { workers } = useWorkers();
  const hasWorkers = workers && workers.length > 0;

  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer?: string; worker?: string }>
  >({});
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [draftOverridesByField, setDraftOverridesByField] = useState<
    Record<string, YardOverrideDraft[]>
  >({});
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const activeLocations = useMemo(
    () => [...locations].filter((l) => l.active).sort((a, b) => a.name.localeCompare(b.name)),
    [locations]
  );

  const orgCustomerMap = useMemo(
    () => buildOrgDefaultPricingMap(customerPricing, (r) => r.field_config_id || null),
    [customerPricing]
  );
  const orgWorkerMap = useMemo(
    () => buildOrgDefaultPricingMap(workerPricing, (r) => r.field_config_id || null),
    [workerPricing]
  );
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

  const getOverrideRowsForField = (fieldId: string): ExistingOverrideRow[] => {
    const customerRows = getScopedPricingOverrides(
      customerPricing,
      fieldId,
      null,
      "customer",
      effectiveAt
    );
    const workerRows = getScopedPricingOverrides(
      workerPricing,
      fieldId,
      null,
      "worker",
      effectiveAt
    );
    const merged = mergeOverrideRowsByLocation(customerRows, workerRows);
    const customerRecord = customerPricingMap[fieldId]?.record;
    const orgDefaultCustomer = customerRecord?.customer_price ?? null;

    return merged
      .filter((row) => row.scopeType === "location")
      .map((row) => {
        const customerRule = customerPricing.find((p) => p.id === row.customerRuleId);
        const workerRule = workerPricing.find((p) => p.id === row.workerRuleId);
        const locId = customerRule?.location_id ?? workerRule?.location_id ?? "";

        return {
          locationId: locId,
          locationName: row.scopeLabel,
          customerPrice: row.price,
          workerPrice: row.workerPayment ?? null,
          validUntil: row.expiresAt ? row.expiresAt.split("T")[0] : null,
          customerRuleId: row.customerRuleId,
          workerRuleId: row.workerRuleId,
          isActive: row.isActive,
          revertsToCustomer: orgDefaultCustomer,
        };
      });
  };

  const saveFieldOverrideDrafts = async (fieldConfig: FieldConfig, drafts: YardOverrideDraft[]) => {
    const customerRecord = customerPricingMap[fieldConfig.id]?.record;
    const orgDefaultCustomer = customerRecord?.customer_price ?? null;

    for (const draft of drafts) {
      if (draft.validUntil && orgDefaultCustomer == null) {
        toast.error(
          `Set an All yards price for ${fieldConfig.label} before adding a dated yard override.`
        );
        return;
      }
    }

    setOverrideSaving(true);
    try {
      for (const draft of drafts) {
        const customerPrice = parsePriceValue(draft.customerPrice);
        const workerPrice = parsePriceValue(draft.workerPrice);
        if (customerPrice === undefined) {
          throw new Error(`Customer price required for ${draft.locationName}`);
        }

        const expirationDate = draft.validUntil || null;

        await upsertCustomerPricing(fieldConfig.id, customerPrice, {
          appliesToFieldType: fieldConfig.field_type,
          pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
          locationId: draft.locationId,
          locationHierarchyId: null,
          expirationDate,
          pricingContext: "customer",
        });

        if (workerPrice !== undefined && hasWorkers) {
          await upsertWorkerPricing(fieldConfig.id, workerPrice, {
            appliesToFieldType: fieldConfig.field_type,
            pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
            locationId: draft.locationId,
            locationHierarchyId: null,
            expirationDate,
            pricingContext: "worker",
          });
        }
      }
      await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
      setDraftOverridesByField((prev) => ({ ...prev, [fieldConfig.id]: [] }));
      refreshPricingHistory();
      toast.success("Yard overrides saved");
    } catch (err) {
      log.error("Failed to save field yard overrides", {
        error: err instanceof Error ? err.message : "Unknown error",
        fieldConfigId: fieldConfig.id,
      });
      toast.error("Failed to save yard overrides");
    } finally {
      setOverrideSaving(false);
    }
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

          const conditions = customerPricingRecord?.source_rule?.conditions ?? [];
          const hasScopedValue = isEntryForScope(pricingEntry, scopeSource);

          const overrideCount = countLocationOverrides(
            customerPricing.filter((p) => p.field_config_id === fieldConfig.id && p.location_id)
          );
          const display = resolveDisplayScope(
            orgCustomerMap[fieldConfig.id],
            orgWorkerMap[fieldConfig.id],
            orgCustomerMap[fieldConfig.id],
            orgWorkerMap[fieldConfig.id],
            overrideCount,
            false,
            formatCurrency
          );

          const existingOverrides = getOverrideRowsForField(fieldConfig.id);
          const drafts = draftOverridesByField[fieldConfig.id] ?? [];
          const usedLocationIds = new Set([
            ...existingOverrides.map((o) => o.locationId),
            ...drafts.map((d) => d.locationId),
          ]);

          const yardScope =
            !locationId && !locationHierarchyId
              ? {
                  chipVariant: display.chip,
                  inheritedLabel: display.inheritedLabel,
                  overrideCount,
                  expanded: expandedFieldId === fieldConfig.id,
                  onExpandedChange: (open: boolean) =>
                    setExpandedFieldId(open ? fieldConfig.id : null),
                  existingOverrides,
                  availableLocations: activeLocations,
                  usedLocationIds,
                  orgDefaultCustomer: customerPricingRecord?.customer_price ?? null,
                  orgDefaultWorker: workerPricingRecord?.worker_payment_value ?? null,
                  draftOverrides: drafts,
                  onAddDraftOverride: (locId: string, locName: string) => {
                    setDraftOverridesByField((prev) => ({
                      ...prev,
                      [fieldConfig.id]: [
                        ...(prev[fieldConfig.id] ?? []),
                        {
                          draftId: `${locId}-${Date.now()}`,
                          locationId: locId,
                          locationName: locName,
                          customerPrice: currentCustomerPrice || "",
                          workerPrice: currentWorkerPrice || "",
                          validUntil: "",
                        },
                      ],
                    }));
                  },
                  onUpdateDraftOverride: (
                    draftId: string,
                    patch: Partial<
                      Pick<YardOverrideDraft, "customerPrice" | "workerPrice" | "validUntil">
                    >
                  ) => {
                    setDraftOverridesByField((prev) => ({
                      ...prev,
                      [fieldConfig.id]: (prev[fieldConfig.id] ?? []).map((d) =>
                        d.draftId === draftId ? { ...d, ...patch } : d
                      ),
                    }));
                  },
                  onRemoveDraftOverride: (draftId: string) => {
                    setDraftOverridesByField((prev) => ({
                      ...prev,
                      [fieldConfig.id]: (prev[fieldConfig.id] ?? []).filter(
                        (d) => d.draftId !== draftId
                      ),
                    }));
                  },
                  onDeleteExistingOverride: async (row: ExistingOverrideRow) => {
                    try {
                      if (row.customerRuleId) {
                        await deleteCustomerPricing(row.customerRuleId);
                      }
                      if (row.workerRuleId) {
                        await deleteWorkerPricing(row.workerRuleId);
                      }
                      await Promise.all([refetchCustomerPricing(), refetchWorkerPricing()]);
                      refreshPricingHistory();
                      toast.success("Override removed");
                    } catch {
                      toast.error("Failed to remove override");
                    }
                  },
                  onSaveOverrides: async () => {
                    await saveFieldOverrideDrafts(fieldConfig, drafts);
                  },
                  saving: overrideSaving,
                  isMobile,
                  hasWorkers: !!hasWorkers,
                }
              : undefined;

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
              conditions={conditions}
              hasScopedValue={hasScopedValue}
              locationId={locationId}
              locationHierarchyId={locationHierarchyId}
              onPriceChange={handlePriceChange}
              onSave={handleSave}
              onDiscard={() => handleDiscard(fieldConfig.id)}
              onNavigateToHistory={onNavigateToHistory}
              onOpenConditionalModal={openConditionalModal}
              yardScope={yardScope}
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
