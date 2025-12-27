"use client";

import {
  ConditionalRuleBuilder,
  type ConditionalRuleDraft,
} from "@/components/pricing/conditional-rule-builder";
import { ConditionalRuleChips } from "@/components/pricing/conditional-rule-chips";
import {
  LocationOverridesMatrix,
  type LocationOverrideRow,
} from "@/components/pricing/location-overrides-matrix";
import { serializeCondition } from "@/components/pricing/pricing-condition-helpers";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSkeleton } from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { useBasePricing } from "@/hooks/use-base-pricing";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkers } from "@/hooks/use-workers";
import { log } from "@/lib/logger";
import {
  buildScopedPricingMap,
  getPricingScopeSource,
  isEntryForScope,
} from "@/lib/pricing-scope";
import type { BasePricing } from "@/lib/types";
import { isPricingRulesEnabled } from "@/lib/utils";
import {
  AlertCircle,
  ChevronDown,
  DollarSign,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface BasePricingEditorProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
  showBothContexts?: boolean; // When true, shows both customer and worker pricing side-by-side
}

export default function BasePricingEditor({
  locationHierarchyId = null,
  locationId = null,
  effectiveAt = null,
  pricingContext = "customer",
  showBothContexts = false,
}: BasePricingEditorProps) {
  const { fieldConfigs } = useFieldConfigs();
  const { workers } = useWorkers();
  const hasWorkers = workers && workers.length > 0;
  const {
    basePricing: customerPricing,
    loading: customerLoading,
    error: customerError,
    upsertPricing: upsertCustomerPricing,
    deletePricing: deleteCustomerPricing,
  } = useBasePricing({
    locationHierarchyId,
    locationId,
    effectiveAt,
    pricingContext: "customer",
  });
  const {
    basePricing: workerPricing,
    loading: workerLoading,
    error: workerError,
    upsertPricing: upsertWorkerPricing,
    deletePricing: deleteWorkerPricing,
  } = useBasePricing({
    locationHierarchyId,
    locationId,
    effectiveAt,
    pricingContext: "worker",
  });

  // Use the appropriate pricing based on showBothContexts
  const basePricing = showBothContexts
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
  useOrganizationCurrency(); // Hook used for currency context

  const scopeParams = useMemo(
    () => ({ locationId, locationHierarchyId }),
    [locationId, locationHierarchyId]
  );
  const scopeSource = getPricingScopeSource(scopeParams);

  // Filter to select-type fields for field-based pricing
  const selectFieldConfigs = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "select");
  }, [fieldConfigs]);

  const hasSelectFields = selectFieldConfigs.length > 0;

  // Default to field-based only if select fields exist, otherwise standalone
  const [isFieldBased, setIsFieldBased] = useState(
    () => fieldConfigs.filter((fc) => fc.field_type === "select").length > 0
  );
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<
    string | null
  >(null);
  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer?: string; worker?: string }>
  >({});
  const [editingAdjustmentTypes, setEditingAdjustmentTypes] = useState<
    Record<string, "add" | "multiply">
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const fieldLabelLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    fieldConfigs.forEach((fc) => {
      lookup[fc.id] = fc.label;
    });
    return lookup;
  }, [fieldConfigs]);

  // Create maps for quick lookup
  const customerStandaloneEntry = useMemo(() => {
    const map = buildScopedPricingMap(
      customerPricing.filter((p) => !p.job_type_field_config_id),
      scopeParams,
      () => "standalone"
    );
    return map["standalone"];
  }, [customerPricing, scopeParams]);

  const workerStandaloneEntry = useMemo(() => {
    const map = buildScopedPricingMap(
      workerPricing.filter((p) => !p.job_type_field_config_id),
      scopeParams,
      () => "standalone"
    );
    return map["standalone"];
  }, [workerPricing, scopeParams]);

  // For backward compatibility
  const standaloneEntry = showBothContexts
    ? customerStandaloneEntry
    : pricingContext === "customer"
    ? customerStandaloneEntry
    : workerStandaloneEntry;

  const customerStandalonePricing = customerStandaloneEntry?.record ?? null;
  const workerStandalonePricing = workerStandaloneEntry?.record ?? null;
  const standalonePricing = showBothContexts
    ? customerStandalonePricing
    : pricingContext === "customer"
    ? customerStandalonePricing
    : workerStandalonePricing;
  const standaloneConditions = standalonePricing?.source_rule?.conditions ?? [];
  const standaloneHasScopedValue = isEntryForScope(
    standaloneEntry,
    scopeSource
  );

  const customerFieldBasedPricingMap = useMemo(() => {
    if (!selectedFieldConfigId) {
      return {};
    }
    return buildScopedPricingMap(
      customerPricing.filter(
        (p) => p.job_type_field_config_id === selectedFieldConfigId
      ),
      scopeParams,
      (record) => record.job_type_value || null
    );
  }, [customerPricing, selectedFieldConfigId, scopeParams]);

  const workerFieldBasedPricingMap = useMemo(() => {
    if (!selectedFieldConfigId) {
      return {};
    }
    return buildScopedPricingMap(
      workerPricing.filter(
        (p) => p.job_type_field_config_id === selectedFieldConfigId
      ),
      scopeParams,
      (record) => record.job_type_value || null
    );
  }, [workerPricing, selectedFieldConfigId, scopeParams]);

  // For backward compatibility
  const fieldBasedPricingMap = showBothContexts
    ? customerFieldBasedPricingMap
    : pricingContext === "customer"
    ? customerFieldBasedPricingMap
    : workerFieldBasedPricingMap;

  const handlePriceChange = (
    key: string,
    value: string,
    type: "customer" | "worker" = "customer"
  ) => {
    setEditingPrices((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: value,
      },
    }));
  };

  const handleStandaloneRuleSubmit = async (
    draft: ConditionalRuleDraft
  ): Promise<void> => {
    if (!standalonePricing) {
      setRuleError("Save a standalone base price before adding rules.");
      return;
    }

    setRuleSaving(true);
    setRuleError(null);
    try {
      const existingConditions =
        standalonePricing.source_rule.conditions?.map(serializeCondition) ?? [];
      const nextConditions = [
        ...existingConditions,
        {
          condition_field_config_id: draft.condition_field_config_id,
          operator: draft.operator,
          condition_value: draft.condition_value,
          action_type: draft.action_type,
          action_value: draft.action_value,
          metadata: { created_in_dashboard: true },
          priority: existingConditions.length + 1,
        },
      ];

      const request = {
        standalone_base_price:
          (editingAdjustmentTypes["standalone"] ||
            standalonePricing.adjustment_type) === "add"
            ? standalonePricing.customer_base_price
            : 0,
        customer_base_price: standalonePricing.customer_base_price,
        adjustment_type:
          editingAdjustmentTypes["standalone"] ||
          standalonePricing.adjustment_type,
        conditions: nextConditions,
        effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
        pricingContext,
      } as Parameters<typeof upsertPricing>[0];
      await upsertPricing(request);
    } catch (error) {
      log.error("Failed to add conditional rule", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setRuleError(
        error instanceof Error ? error.message : "Failed to add rule."
      );
    } finally {
      setRuleSaving(false);
    }
  };

  const handleAdjustmentTypeChange = (
    key: string,
    type: "add" | "multiply"
  ) => {
    setEditingAdjustmentTypes((prev) => ({
      ...prev,
      [key]: type,
    }));
  };

  const handleSaveStandalone = async () => {
    const editing = editingPrices["standalone"];
    if (!editing) return;

    if (showBothContexts) {
      // Save both customer and worker pricing
      const customerPrice = editing.customer
        ? parseFloat(editing.customer)
        : null;
      const workerPrice = editing.worker ? parseFloat(editing.worker) : null;

      const adjustmentType =
        editingAdjustmentTypes["standalone"] ||
        customerStandalonePricing?.adjustment_type ||
        "add";

      if (
        (customerPrice === null || isNaN(customerPrice)) &&
        (workerPrice === null || isNaN(workerPrice))
      ) {
        return;
      }

      // Validate based on adjustment type
      if (
        customerPrice !== null &&
        !isNaN(customerPrice) &&
        ((adjustmentType === "add" && customerPrice < 0) ||
          (adjustmentType === "multiply" && customerPrice <= 0))
      ) {
        return;
      }
      if (
        workerPrice !== null &&
        !isNaN(workerPrice) &&
        ((adjustmentType === "add" && workerPrice < 0) ||
          (adjustmentType === "multiply" && workerPrice <= 0))
      ) {
        return;
      }

      setSaving((prev) => ({ ...prev, standalone: true }));
      try {
        const existingConditions =
          customerStandalonePricing?.source_rule?.conditions?.map(
            serializeCondition
          ) ?? undefined;

        // Save customer pricing if provided
        if (customerPrice !== null && !isNaN(customerPrice)) {
          await upsertCustomerPricing({
            standalone_base_price: adjustmentType === "add" ? customerPrice : 0,
            customer_base_price: customerPrice,
            adjustment_type: adjustmentType,
            conditions: existingConditions,
            location_id: locationId,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "customer",
          });
        }

        // Save worker pricing if provided
        if (workerPrice !== null && !isNaN(workerPrice)) {
          await upsertWorkerPricing({
            standalone_base_price: adjustmentType === "add" ? workerPrice : 0,
            customer_base_price: workerPrice, // For worker, this is the base payment
            worker_base_payment: workerPrice,
            adjustment_type: adjustmentType,
            conditions: existingConditions,
            location_id: locationId,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "worker",
          });
        }

        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next.standalone;
          return next;
        });
        setEditingAdjustmentTypes((prev) => {
          const next = { ...prev };
          delete next.standalone;
          return next;
        });
      } catch (error) {
        log.error("Failed to save standalone base pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setSaving((prev) => {
          const next = { ...prev };
          delete next.standalone;
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

      const adjustmentType =
        editingAdjustmentTypes["standalone"] ||
        standalonePricing?.adjustment_type ||
        "add";

      const price = parseFloat(priceValue);
      if (isNaN(price)) {
        return;
      }

      // Validate based on adjustment type
      if (adjustmentType === "add" && price < 0) {
        return;
      }
      if (adjustmentType === "multiply" && price <= 0) {
        return;
      }

      setSaving((prev) => ({ ...prev, standalone: true }));
      try {
        const existingConditions =
          standalonePricing?.source_rule?.conditions?.map(serializeCondition) ??
          undefined;
        const request = {
          standalone_base_price: adjustmentType === "add" ? price : 0,
          customer_base_price: price,
          worker_base_payment: pricingContext === "worker" ? price : undefined,
          adjustment_type: adjustmentType,
          conditions: existingConditions,
          location_id: locationId,
          effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
          pricingContext,
        } as Parameters<typeof upsertPricing>[0];
        await upsertPricing(request);
        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next.standalone;
          return next;
        });
        setEditingAdjustmentTypes((prev) => {
          const next = { ...prev };
          delete next.standalone;
          return next;
        });
      } catch (error) {
        log.error("Failed to save standalone base pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setSaving((prev) => {
          const next = { ...prev };
          delete next.standalone;
          return next;
        });
      }
    }
  };

  const handleSaveFieldBased = async (optionValue: string) => {
    const editing = editingPrices[optionValue];
    if (!editing) return;

    if (!selectedFieldConfigId) {
      return;
    }

    if (showBothContexts) {
      // Save both customer and worker pricing
      const customerPrice = editing.customer
        ? parseFloat(editing.customer)
        : null;
      const workerPrice = editing.worker ? parseFloat(editing.worker) : null;

      const customerEntry = customerFieldBasedPricingMap[optionValue];
      const workerEntry = workerFieldBasedPricingMap[optionValue];
      const adjustmentType =
        editingAdjustmentTypes[optionValue] ||
        customerEntry?.record?.adjustment_type ||
        workerEntry?.record?.adjustment_type ||
        "add";

      if (
        (customerPrice === null || isNaN(customerPrice)) &&
        (workerPrice === null || isNaN(workerPrice))
      ) {
        return;
      }

      // Validate based on adjustment type
      if (
        customerPrice !== null &&
        !isNaN(customerPrice) &&
        ((adjustmentType === "add" && customerPrice < 0) ||
          (adjustmentType === "multiply" && customerPrice <= 0))
      ) {
        return;
      }
      if (
        workerPrice !== null &&
        !isNaN(workerPrice) &&
        ((adjustmentType === "add" && workerPrice < 0) ||
          (adjustmentType === "multiply" && workerPrice <= 0))
      ) {
        return;
      }

      setSaving((prev) => ({ ...prev, [optionValue]: true }));
      try {
        // Save customer pricing if provided
        if (customerPrice !== null && !isNaN(customerPrice)) {
          await upsertCustomerPricing({
            job_type_field_config_id: selectedFieldConfigId,
            job_type_value: optionValue,
            customer_base_price: customerPrice,
            adjustment_type: adjustmentType,
            location_id: locationId,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "customer",
          });
        }

        // Save worker pricing if provided
        if (workerPrice !== null && !isNaN(workerPrice)) {
          await upsertWorkerPricing({
            job_type_field_config_id: selectedFieldConfigId,
            job_type_value: optionValue,
            customer_base_price: workerPrice, // For worker, this is the base payment
            worker_base_payment: workerPrice,
            adjustment_type: adjustmentType,
            location_id: locationId,
            effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
            pricingContext: "worker",
          });
        }

        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
        setEditingAdjustmentTypes((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      } catch (error) {
        log.error("Failed to save field-based base pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
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

      const pricingEntry = fieldBasedPricingMap[optionValue];
      const adjustmentType =
        editingAdjustmentTypes[optionValue] ||
        pricingEntry?.record?.adjustment_type ||
        "add";

      const price = parseFloat(priceValue);
      if (isNaN(price)) {
        return;
      }

      // Validate based on adjustment type
      if (adjustmentType === "add" && price < 0) {
        return;
      }
      if (adjustmentType === "multiply" && price <= 0) {
        return;
      }

      setSaving((prev) => ({ ...prev, [optionValue]: true }));
      try {
        await upsertPricing({
          job_type_field_config_id: selectedFieldConfigId,
          job_type_value: optionValue,
          customer_base_price: price,
          worker_base_payment: pricingContext === "worker" ? price : undefined,
          adjustment_type: adjustmentType,
          location_id: locationId,
          effectiveAt: effectiveAt, // Pass the scope's effective date for timeline support
          pricingContext,
        });
        setEditingPrices((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
        setEditingAdjustmentTypes((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      } catch (error) {
        log.error("Failed to save field-based base pricing", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setSaving((prev) => {
          const next = { ...prev };
          delete next[optionValue];
          return next;
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      await deletePricing(id);
    } catch (error) {
      log.error("Failed to delete base pricing", {
        error: error instanceof Error ? error.message : "Unknown error",
        pricingId: id,
      });
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const selectedFieldConfig = useMemo(() => {
    return selectFieldConfigs.find((fc) => fc.id === selectedFieldConfigId);
  }, [selectFieldConfigs, selectedFieldConfigId]);

  // Force standalone mode if no select fields are available
  useEffect(() => {
    if (!hasSelectFields && isFieldBased) {
      setIsFieldBased(false);
    }
  }, [hasSelectFields, isFieldBased]);

  // Auto-select first field when switching to field-based mode
  useEffect(() => {
    if (isFieldBased && hasSelectFields && !selectedFieldConfigId) {
      setSelectedFieldConfigId(selectFieldConfigs[0]?.id || null);
    }
  }, [
    isFieldBased,
    hasSelectFields,
    selectFieldConfigs,
    selectedFieldConfigId,
  ]);

  // Reset selected field when switching to standalone mode
  useEffect(() => {
    if (!isFieldBased) {
      setSelectedFieldConfigId(null);
    }
  }, [isFieldBased]);

  if (loading) {
    return <FormSkeleton fields={4} />;
  }

  if (error) {
    return (
      <div className="text-center py-4 text-destructive">Error: {error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle between field-based and standalone */}
      {hasSelectFields && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Adjustment Type</CardTitle>
            <CardDescription>
              Choose how to adjust the invoice total — universally or based on
              service type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Service-Based Adjustment</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedFieldConfig
                    ? `Adjustment varies by ${selectedFieldConfig.label} selection`
                    : "Set different adjustments based on service type (e.g., Basic vs Premium)"}
                </p>
              </div>
              <Switch
                checked={isFieldBased}
                onCheckedChange={setIsFieldBased}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Universal Adjustment */}
      {!isFieldBased && (
        <Card>
          <CardHeader>
            <CardTitle>Universal Adjustment</CardTitle>
            <CardDescription>
              Apply a fixed fee (e.g., call-out fee) or multiplier (e.g., profit
              margin) to every invoice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adjustment Type Toggle */}
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="standalone-adjustment-type"
                    checked={
                      (editingAdjustmentTypes["standalone"] ||
                        standalonePricing?.adjustment_type ||
                        "add") === "add"
                    }
                    onChange={() =>
                      handleAdjustmentTypeChange("standalone", "add")
                    }
                    className="h-4 w-4"
                    disabled={
                      saving["standalone"] ||
                      deleting[standalonePricing?.id || ""]
                    }
                  />
                  <span className="text-sm">Add Amount</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="standalone-adjustment-type"
                    checked={
                      (editingAdjustmentTypes["standalone"] ||
                        standalonePricing?.adjustment_type ||
                        "add") === "multiply"
                    }
                    onChange={() =>
                      handleAdjustmentTypeChange("standalone", "multiply")
                    }
                    className="h-4 w-4"
                    disabled={
                      saving["standalone"] ||
                      deleting[standalonePricing?.id || ""]
                    }
                  />
                  <span className="text-sm">Multiply Invoice</span>
                </label>
              </div>
            </div>

            {/* Equation Preview */}
            <div className="bg-muted/50 rounded-md p-2 text-sm">
              <span className="text-muted-foreground">Equation: </span>
              <span className="font-mono font-medium">
                {(editingAdjustmentTypes["standalone"] ||
                  standalonePricing?.adjustment_type ||
                  "add") === "add"
                  ? "Total = invoice_total + amount"
                  : "Total = invoice_total × multiplier"}
              </span>
            </div>

            {showBothContexts ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="standalone-customer">
                    Customer{" "}
                    {(editingAdjustmentTypes["standalone"] ||
                      customerStandalonePricing?.adjustment_type ||
                      "add") === "add"
                      ? "Amount to Add"
                      : "Multiplier"}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="standalone-customer"
                      type="number"
                      step="0.01"
                      min={
                        (editingAdjustmentTypes["standalone"] ||
                          customerStandalonePricing?.adjustment_type ||
                          "add") === "multiply"
                          ? "0.01"
                          : "0"
                      }
                      placeholder={
                        (editingAdjustmentTypes["standalone"] ||
                          customerStandalonePricing?.adjustment_type ||
                          "add") === "multiply"
                          ? "1.00"
                          : "0.00"
                      }
                      value={
                        editingPrices["standalone"]?.customer !== undefined
                          ? editingPrices["standalone"].customer
                          : customerStandalonePricing
                          ? customerStandalonePricing.customer_base_price.toString()
                          : ""
                      }
                      onChange={(e) =>
                        handlePriceChange(
                          "standalone",
                          e.target.value,
                          "customer"
                        )
                      }
                      className="pl-9"
                      disabled={
                        saving["standalone"] ||
                        deleting[customerStandalonePricing?.id || ""]
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="standalone-worker">
                    Worker{" "}
                    {(editingAdjustmentTypes["standalone"] ||
                      workerStandalonePricing?.adjustment_type ||
                      "add") === "add"
                      ? "Amount to Add"
                      : "Multiplier"}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="standalone-worker"
                      type="number"
                      step="0.01"
                      min={
                        (editingAdjustmentTypes["standalone"] ||
                          workerStandalonePricing?.adjustment_type ||
                          "add") === "multiply"
                          ? "0.01"
                          : "0"
                      }
                      placeholder={
                        (editingAdjustmentTypes["standalone"] ||
                          workerStandalonePricing?.adjustment_type ||
                          "add") === "multiply"
                          ? "1.00"
                          : "0.00"
                      }
                      value={
                        editingPrices["standalone"]?.worker !== undefined
                          ? editingPrices["standalone"].worker
                          : workerStandalonePricing
                          ? workerStandalonePricing.worker_base_payment?.toString() ||
                            ""
                          : ""
                      }
                      onChange={(e) =>
                        handlePriceChange(
                          "standalone",
                          e.target.value,
                          "worker"
                        )
                      }
                      className="pl-9"
                      disabled={
                        saving["standalone"] ||
                        deleting[workerStandalonePricing?.id || ""]
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="standalone-customer">
                  {(editingAdjustmentTypes["standalone"] ||
                    standalonePricing?.adjustment_type ||
                    "add") === "add"
                    ? "Amount to Add (USD)"
                    : "Multiplier (e.g., 1.2 = 20% increase)"}
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="standalone-customer"
                    type="number"
                    step="0.01"
                    min={
                      (editingAdjustmentTypes["standalone"] ||
                        standalonePricing?.adjustment_type ||
                        "add") === "multiply"
                        ? "0.01"
                        : "0"
                    }
                    placeholder={
                      (editingAdjustmentTypes["standalone"] ||
                        standalonePricing?.adjustment_type ||
                        "add") === "multiply"
                        ? "1.00"
                        : "0.00"
                    }
                    value={
                      editingPrices["standalone"]?.[pricingContext] !==
                      undefined
                        ? editingPrices["standalone"][pricingContext]
                        : standalonePricing
                        ? pricingContext === "customer"
                          ? standalonePricing.customer_base_price.toString()
                          : standalonePricing.worker_base_payment?.toString() ||
                            ""
                        : ""
                    }
                    onChange={(e) =>
                      handlePriceChange(
                        "standalone",
                        e.target.value,
                        pricingContext
                      )
                    }
                    className="pl-9"
                    disabled={
                      saving["standalone"] ||
                      deleting[standalonePricing?.id || ""]
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {(editingAdjustmentTypes["standalone"] ||
                    standalonePricing?.adjustment_type ||
                    "add") === "add"
                    ? "A fixed amount added to every invoice"
                    : "Multiplier applies to the entire invoice (1.0 = no change, 1.2 = 20% increase, 0.9 = 10% decrease)"}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {standalonePricing && standaloneHasScopedValue && (
                <Button
                  variant="outline"
                  onClick={() => handleDelete(standalonePricing.id)}
                  disabled={
                    saving["standalone"] || deleting[standalonePricing.id]
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSaveStandalone}
                disabled={
                  !editingPrices["standalone"] ||
                  (showBothContexts
                    ? (!editingPrices["standalone"].customer ||
                        isNaN(
                          parseFloat(editingPrices["standalone"].customer || "")
                        ) ||
                        parseFloat(editingPrices["standalone"].customer || "") <
                          0) &&
                      (!editingPrices["standalone"].worker ||
                        isNaN(
                          parseFloat(editingPrices["standalone"].worker || "")
                        ) ||
                        parseFloat(editingPrices["standalone"].worker || "") <
                          0)
                    : pricingContext === "customer"
                    ? !editingPrices["standalone"].customer ||
                      isNaN(
                        parseFloat(editingPrices["standalone"].customer || "")
                      ) ||
                      parseFloat(editingPrices["standalone"].customer || "") < 0
                    : !editingPrices["standalone"].worker ||
                      isNaN(
                        parseFloat(editingPrices["standalone"].worker || "")
                      ) ||
                      parseFloat(editingPrices["standalone"].worker || "") <
                        0) ||
                  saving["standalone"] ||
                  deleting[standalonePricing?.id || ""]
                }
              >
                {saving["standalone"] ? (
                  "Saving..."
                ) : standaloneHasScopedValue ? (
                  "Update"
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>

            {/* Location Overrides for Standalone */}
            {(() => {
              const standaloneOverrides = getBasePricingOverrides(
                basePricing,
                null, // standalone has no job_type_field_config_id
                null, // standalone has no job_type_value
                locationId,
                locationHierarchyId
              );
              // Only show if there are overrides
              if (standaloneOverrides.length === 0) {
                return null;
              }
              return (
                <LocationOverridesMatrix
                  rows={standaloneOverrides}
                  emptyMessage="No location overrides yet. Select a location in 'Where to Apply Pricing' above, then edit the base price to create an override."
                  onDelete={async (id) => {
                    try {
                      await deletePricing(id);
                    } catch (error) {
                      log.error("Failed to delete override", {
                        error:
                          error instanceof Error
                            ? error.message
                            : "Unknown error",
                        pricingId: id,
                      });
                    }
                  }}
                />
              );
            })()}

            {standalonePricing && isPricingRulesEnabled() && (
              <Collapsible defaultOpen={standaloneConditions.length > 0}>
                <div className="space-y-3 border-t pt-4">
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80 transition-opacity group cursor-pointer">
                    <div className="text-left">
                      <Label className="text-sm font-semibold">
                        Conditional Rules
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Add adjustments when other fields meet certain criteria
                        (e.g., +$50 if vehicle type is &quot;Large Truck&quot;)
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {standaloneConditions.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          No conditional rules yet
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Add rules below to trigger automatic adjustments based
                          on field values
                        </p>
                      </div>
                    ) : (
                      <ConditionalRuleChips
                        conditions={standaloneConditions}
                        fieldLabels={fieldLabelLookup}
                        emptyMessage="No conditional adjustments for the base price yet."
                      />
                    )}
                    <ConditionalRuleBuilder
                      fieldOptions={fieldConfigs}
                      saving={ruleSaving}
                      error={ruleError}
                      onSubmit={handleStandaloneRuleSubmit}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* Service-Based Adjustment */}
      {isFieldBased && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedFieldConfig
                ? `Service-Based Adjustment by ${selectedFieldConfig.label}`
                : "Service-Based Adjustment"}
            </CardTitle>
            <CardDescription>
              {selectedFieldConfig
                ? `Set different adjustments for each ${selectedFieldConfig.label} option (e.g., premium services get higher markup)`
                : "Select a service type field to vary adjustments by option"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* How it works */}
            {selectedFieldConfig && (
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p className="font-medium text-foreground">How it works:</p>
                <p className="text-muted-foreground">
                  Set different adjustments for each {selectedFieldConfig.label}{" "}
                  option. For example, if &quot;Premium Service&quot; has a $50
                  call-out fee and &quot;Basic Service&quot; has no fee →{" "}
                  <span className="font-medium text-foreground">
                    Premium adds $50, Basic adds $0
                  </span>{" "}
                  to the invoice total.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="field-select">Select Field</Label>
              <Select
                value={selectedFieldConfigId || ""}
                onValueChange={setSelectedFieldConfigId}
              >
                <SelectTrigger id="field-select">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {selectFieldConfigs.map((fc) => (
                    <SelectItem key={fc.id} value={fc.id}>
                      {fc.label} ({fc.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFieldConfig && selectedFieldConfig.options && (
              <div className="space-y-4">
                {/* Compact Inline-Editable Table */}
                <div className="rounded-lg border overflow-hidden">
                  {/* Table Header */}
                  <div
                    className={`grid ${
                      showBothContexts
                        ? "grid-cols-[1fr_120px_140px_140px]"
                        : "grid-cols-[1fr_120px_140px]"
                    } gap-2 p-3 bg-muted/50 border-b text-sm font-medium`}
                  >
                    <div>Option</div>
                    <div>Type</div>
                    <div>Customer Adjustment</div>
                    {showBothContexts && <div>Worker Adjustment</div>}
                  </div>

                  {/* Table Body - Inline Editable Rows */}
                  <div className="divide-y">
                    {selectedFieldConfig.options.map((optionValue) => {
                      const customerEntry =
                        customerFieldBasedPricingMap[optionValue];
                      const workerEntry =
                        workerFieldBasedPricingMap[optionValue];
                      const customerPricing = customerEntry?.record;
                      const workerPricing = workerEntry?.record;

                      const existingPricing = showBothContexts
                        ? customerPricing
                        : pricingContext === "customer"
                        ? customerPricing
                        : workerPricing;

                      const editing = editingPrices[optionValue];
                      const currentAdjustmentType =
                        editingAdjustmentTypes[optionValue] ||
                        existingPricing?.adjustment_type ||
                        "add";
                      const currentCustomerPrice =
                        editing?.customer !== undefined
                          ? editing.customer
                          : customerPricing
                          ? customerPricing.customer_base_price.toString()
                          : "";
                      const currentWorkerPrice =
                        editing?.worker !== undefined
                          ? editing.worker
                          : workerPricing
                          ? workerPricing.worker_base_payment?.toString() || ""
                          : "";

                      return (
                        <div
                          key={optionValue}
                          className={`grid ${
                            showBothContexts
                              ? "grid-cols-[1fr_120px_140px_140px]"
                              : "grid-cols-[1fr_120px_140px]"
                          } gap-2 p-2 items-center hover:bg-muted/30 transition-colors`}
                        >
                          <div
                            className="text-sm font-medium truncate"
                            title={optionValue}
                          >
                            {optionValue}
                          </div>
                          <div className="flex gap-2">
                            <label className="flex items-center space-x-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`adjustment-type-${optionValue}`}
                                checked={currentAdjustmentType === "add"}
                                onChange={() =>
                                  handleAdjustmentTypeChange(optionValue, "add")
                                }
                                className="h-3 w-3"
                                disabled={
                                  saving[optionValue] ||
                                  deleting[existingPricing?.id || ""]
                                }
                              />
                              <span className="text-xs">Add</span>
                            </label>
                            <label className="flex items-center space-x-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`adjustment-type-${optionValue}`}
                                checked={currentAdjustmentType === "multiply"}
                                onChange={() =>
                                  handleAdjustmentTypeChange(
                                    optionValue,
                                    "multiply"
                                  )
                                }
                                className="h-3 w-3"
                                disabled={
                                  saving[optionValue] ||
                                  deleting[existingPricing?.id || ""]
                                }
                              />
                              <span className="text-xs">×</span>
                            </label>
                          </div>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min={
                                currentAdjustmentType === "multiply"
                                  ? "0.01"
                                  : "0"
                              }
                              placeholder={
                                currentAdjustmentType === "multiply"
                                  ? "1.00"
                                  : "0.00"
                              }
                              value={currentCustomerPrice}
                              onChange={(e) =>
                                handlePriceChange(
                                  optionValue,
                                  e.target.value,
                                  "customer"
                                )
                              }
                              className="pl-6 h-8 text-sm"
                              disabled={
                                saving[optionValue] ||
                                deleting[customerPricing?.id || ""]
                              }
                            />
                          </div>
                          {showBothContexts && (
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                min={
                                  currentAdjustmentType === "multiply"
                                    ? "0.01"
                                    : "0"
                                }
                                placeholder={
                                  currentAdjustmentType === "multiply"
                                    ? "1.00"
                                    : "0.00"
                                }
                                value={currentWorkerPrice}
                                onChange={(e) =>
                                  handlePriceChange(
                                    optionValue,
                                    e.target.value,
                                    "worker"
                                  )
                                }
                                className="pl-6 h-8 text-sm"
                                disabled={
                                  saving[optionValue] ||
                                  deleting[workerPricing?.id || ""] ||
                                  !hasWorkers
                                }
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
                      Worker payment fields are disabled. Add workers to your
                      organization to enable worker payment settings.
                    </p>
                  </div>
                )}

                {/* Save Button Bar */}
                {(() => {
                  const pendingChanges = selectedFieldConfig.options.filter(
                    (optionValue) => {
                      const editing = editingPrices[optionValue];
                      if (!editing) return false;

                      const customerEntry =
                        customerFieldBasedPricingMap[optionValue];
                      const workerEntry =
                        workerFieldBasedPricingMap[optionValue];
                      const customerPricing = customerEntry?.record;
                      const workerPricing = workerEntry?.record;

                      const hasCustomerChanges =
                        editing.customer !== undefined &&
                        editing.customer !==
                          (customerPricing?.customer_base_price.toString() ||
                            "");
                      const hasWorkerChanges =
                        editing.worker !== undefined &&
                        editing.worker !==
                          (workerPricing?.worker_base_payment?.toString() ||
                            "");

                      return showBothContexts
                        ? hasCustomerChanges || hasWorkerChanges
                        : pricingContext === "customer"
                        ? hasCustomerChanges
                        : hasWorkerChanges;
                    }
                  );

                  if (pendingChanges.length === 0) return null;

                  return (
                    <div className="flex items-center justify-end gap-2 p-3 rounded-lg border bg-muted/30">
                      <Button
                        size="sm"
                        onClick={async () => {
                          // Save all pending changes
                          await Promise.all(
                            pendingChanges.map((optionValue) =>
                              handleSaveFieldBased(optionValue)
                            )
                          );
                        }}
                        disabled={pendingChanges.some(
                          (opt) =>
                            saving[opt] ||
                            deleting[
                              (showBothContexts
                                ? customerFieldBasedPricingMap[opt]?.record
                                : pricingContext === "customer"
                                ? customerFieldBasedPricingMap[opt]?.record
                                : workerFieldBasedPricingMap[opt]?.record
                              )?.id || ""
                            ]
                        )}
                        className="gap-1 cursor-pointer"
                      >
                        <Save className="h-3 w-3" />
                        Save All ({pendingChanges.length})
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getBasePricingOverrides(
  allPricing: BasePricing[],
  jobTypeFieldConfigId: string | null,
  jobTypeValue: string | null,
  currentLocationId: string | null = null,
  currentLocationHierarchyId: string | null = null
): LocationOverrideRow[] {
  const now = new Date().toISOString();

  return allPricing
    .filter(
      (pricing) =>
        (jobTypeFieldConfigId === null
          ? !pricing.job_type_field_config_id
          : pricing.job_type_field_config_id === jobTypeFieldConfigId) &&
        (jobTypeValue === null
          ? !pricing.job_type_value
          : pricing.job_type_value === jobTypeValue) &&
        (pricing.location_id || pricing.location_hierarchy_id) &&
        // Exclude current scope to avoid showing it as an override
        !(
          (currentLocationId && pricing.location_id === currentLocationId) ||
          (currentLocationHierarchyId &&
            pricing.location_hierarchy_id === currentLocationHierarchyId) ||
          (!currentLocationId &&
            !currentLocationHierarchyId &&
            !pricing.location_id &&
            !pricing.location_hierarchy_id)
        )
    )
    .map<LocationOverrideRow>((pricing) => {
      const effectiveAt = pricing.source_rule?.effective_at;
      const expiresAt = pricing.source_rule?.expires_at || null;
      const isActive = effectiveAt
        ? effectiveAt <= now && (!expiresAt || expiresAt > now)
        : undefined;
      const isFuture = effectiveAt ? effectiveAt > now : undefined;

      return {
        id: pricing.id,
        scopeLabel:
          pricing.location?.name ||
          pricing.location_node?.name ||
          pricing.location_id ||
          pricing.location_hierarchy_id ||
          "Custom scope",
        scopeType: pricing.location ? "location" : "hierarchy",
        price: pricing.customer_base_price,
        workerPayment: pricing.worker_base_payment,
        effectiveAt,
        expiresAt,
        isActive,
        isFuture,
      };
    });
}
