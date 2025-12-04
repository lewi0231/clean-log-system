"use client";

import {
  ConditionalRuleBuilder,
  type ConditionalRuleDraft,
} from "@/components/pricing/conditional-rule-builder";
import { ConditionalRuleChips } from "@/components/pricing/conditional-rule-chips";
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
import { LoadingState } from "@/components/ui/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useBasePricing } from "@/hooks/use-base-pricing";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import {
  buildScopedPricingMap,
  getPricingScopeSource,
  isEntryForScope,
} from "@/lib/pricing-scope";
import { isPricingRulesEnabled } from "@/lib/utils";
import { ChevronDown, DollarSign, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface BasePricingEditorProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
}

export default function BasePricingEditor({
  locationHierarchyId = null,
  locationId = null,
  effectiveAt = null,
}: BasePricingEditorProps) {
  const { fieldConfigs } = useFieldConfigs();
  const { basePricing, loading, error, upsertPricing, deletePricing } =
    useBasePricing({
      locationHierarchyId,
      locationId,
      effectiveAt,
    });
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
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    {}
  );
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
  const standaloneEntry = useMemo(() => {
    const map = buildScopedPricingMap(
      basePricing.filter((p) => !p.job_type_field_config_id),
      scopeParams,
      () => "standalone"
    );
    return map["standalone"];
  }, [basePricing, scopeParams]);

  const standalonePricing = standaloneEntry?.record ?? null;
  const standaloneConditions = standalonePricing?.source_rule?.conditions ?? [];
  const standaloneHasScopedValue = isEntryForScope(
    standaloneEntry,
    scopeSource
  );

  const fieldBasedPricingMap = useMemo(() => {
    if (!selectedFieldConfigId) {
      return {};
    }
    return buildScopedPricingMap(
      basePricing.filter(
        (p) => p.job_type_field_config_id === selectedFieldConfigId
      ),
      scopeParams,
      (record) => record.job_type_value || null
    );
  }, [basePricing, selectedFieldConfigId, scopeParams]);

  const handlePriceChange = (key: string, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [key]: value,
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
      } as Parameters<typeof upsertPricing>[0];
      await upsertPricing(request);
    } catch (error) {
      console.error("Failed to add conditional rule", error);
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
    if (!editing || editing.trim() === "") {
      return;
    }

    const adjustmentType =
      editingAdjustmentTypes["standalone"] ||
      standalonePricing?.adjustment_type ||
      "add";

    const customerPrice = parseFloat(editing);
    if (isNaN(customerPrice)) {
      return;
    }

    // Validate based on adjustment type
    if (adjustmentType === "add" && customerPrice < 0) {
      return;
    }
    if (adjustmentType === "multiply" && customerPrice <= 0) {
      return;
    }

    setSaving((prev) => ({ ...prev, standalone: true }));
    try {
      const existingConditions =
        standalonePricing?.source_rule?.conditions?.map(serializeCondition) ??
        undefined;
      const request = {
        standalone_base_price: adjustmentType === "add" ? customerPrice : 0,
        customer_base_price: customerPrice,
        adjustment_type: adjustmentType,
        conditions: existingConditions,
        location_id: locationId,
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
      console.error("Failed to save standalone base pricing", error);
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next.standalone;
        return next;
      });
    }
  };

  const handleSaveFieldBased = async (optionValue: string) => {
    const editing = editingPrices[optionValue];
    if (!editing || editing.trim() === "") {
      return;
    }

    const pricingEntry = fieldBasedPricingMap[optionValue];
    const adjustmentType =
      editingAdjustmentTypes[optionValue] ||
      pricingEntry?.record?.adjustment_type ||
      "add";

    const customerPrice = parseFloat(editing);
    if (isNaN(customerPrice)) {
      return;
    }

    // Validate based on adjustment type
    if (adjustmentType === "add" && customerPrice < 0) {
      return;
    }
    if (adjustmentType === "multiply" && customerPrice <= 0) {
      return;
    }

    if (!selectedFieldConfigId) {
      return;
    }

    setSaving((prev) => ({ ...prev, [optionValue]: true }));
    try {
      await upsertPricing({
        job_type_field_config_id: selectedFieldConfigId,
        job_type_value: optionValue,
        customer_base_price: customerPrice,
        adjustment_type: adjustmentType,
        location_id: locationId,
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
      console.error("Failed to save field-based base pricing", error);
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[optionValue];
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      await deletePricing(id);
    } catch (error) {
      console.error("Failed to delete base pricing", error);
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
    return <LoadingState message="Loading base pricing..." />;
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
            <CardTitle>Base Pricing Type</CardTitle>
            <CardDescription>
              Choose whether base pricing is a fixed amount or varies by field
              selection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Field-Based Pricing</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedFieldConfig
                    ? `Base price varies by ${selectedFieldConfig.label} options`
                    : "Set different base prices for each option in a select field"}
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

      {/* Standalone Base Pricing */}
      {!isFieldBased && (
        <Card>
          <CardHeader>
            <CardTitle>Standalone Base Pricing</CardTitle>
            <CardDescription>
              Add a fixed amount or multiply the entire invoice
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
                    editingPrices["standalone"] !== undefined
                      ? editingPrices["standalone"]
                      : standalonePricing
                      ? standalonePricing.customer_base_price.toString()
                      : ""
                  }
                  onChange={(e) =>
                    handlePriceChange("standalone", e.target.value)
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

            {standalonePricing && isPricingRulesEnabled() && (
              <Collapsible defaultOpen={standaloneConditions.length > 0}>
                <div className="space-y-3 border-t pt-4">
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80 transition-opacity group">
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

      {/* Field-Based Base Pricing */}
      {isFieldBased && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedFieldConfig
                ? `Base Pricing by ${selectedFieldConfig.label}`
                : "Field-Based Base Pricing"}
            </CardTitle>
            <CardDescription>
              {selectedFieldConfig
                ? `Set base prices for each ${selectedFieldConfig.label} option`
                : "Select a field to set base prices for each option"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dynamic Equation Preview */}
            {selectedFieldConfig && (
              <div className="bg-muted/50 rounded-md p-2 text-sm">
                <span className="text-muted-foreground">Equation: </span>
                <span className="font-mono font-medium">
                  Total = adjustment[{selectedFieldConfig.label}] applied to
                  invoice
                </span>
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
              <div className="space-y-3">
                {selectedFieldConfig.options.map((optionValue) => {
                  const pricingEntry = fieldBasedPricingMap[optionValue];
                  const existingPricing = pricingEntry?.record;
                  const editing = editingPrices[optionValue];
                  const currentAdjustmentType =
                    editingAdjustmentTypes[optionValue] ||
                    existingPricing?.adjustment_type ||
                    "add";
                  const currentPrice =
                    editing !== undefined
                      ? editing
                      : existingPricing
                      ? existingPricing.customer_base_price.toString()
                      : "";

                  const hasChanges =
                    editing !== undefined &&
                    editing !==
                      (existingPricing?.customer_base_price.toString() || "");
                  const hasScopedValue = isEntryForScope(
                    pricingEntry,
                    scopeSource
                  );

                  return (
                    <Card key={optionValue} className="p-4">
                      <div className="space-y-3">
                        <Label className="font-medium text-base">
                          {optionValue}
                        </Label>

                        {/* Adjustment Type Toggle */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Adjustment Type
                          </Label>
                          <div className="flex gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
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
                              <span className="text-xs">Add Amount</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
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
                              <span className="text-xs">Multiply Invoice</span>
                            </label>
                          </div>
                        </div>

                        {/* Price Input */}
                        <div className="space-y-2">
                          <Label className="text-xs">
                            {currentAdjustmentType === "add"
                              ? "Amount to Add (USD)"
                              : "Multiplier (e.g., 1.2 = 20% increase)"}
                          </Label>
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
                              value={currentPrice}
                              onChange={(e) =>
                                handlePriceChange(optionValue, e.target.value)
                              }
                              className="pl-7 h-9 text-sm"
                              disabled={
                                saving[optionValue] ||
                                deleting[existingPricing?.id || ""]
                              }
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {currentAdjustmentType === "add"
                              ? "Fixed amount added when this option is selected"
                              : "Multiplier for entire invoice (1.0 = no change)"}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-end">
                          {hasScopedValue && existingPricing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(existingPricing.id)}
                              disabled={
                                saving[optionValue] ||
                                deleting[existingPricing.id]
                              }
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              Delete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleSaveFieldBased(optionValue)}
                            disabled={
                              !hasChanges ||
                              !currentPrice ||
                              isNaN(parseFloat(currentPrice)) ||
                              saving[optionValue] ||
                              deleting[existingPricing?.id || ""]
                            }
                          >
                            {saving[optionValue] ? (
                              "Saving..."
                            ) : hasScopedValue ? (
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
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
