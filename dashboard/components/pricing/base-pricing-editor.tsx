"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DollarSign, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

interface BasePricingEditorProps {
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
}

export default function BasePricingEditor({
  locationHierarchyId = null,
  effectiveAt = null,
}: BasePricingEditorProps) {
  const { fieldConfigs } = useFieldConfigs();
  const { basePricing, loading, error, upsertPricing, deletePricing } =
    useBasePricing({
      locationHierarchyId,
      effectiveAt,
    });

  const [isFieldBased, setIsFieldBased] = useState(true);
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

  // Filter to select-type fields for field-based pricing
  const selectFieldConfigs = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "select");
  }, [fieldConfigs]);

  // Create maps for quick lookup
  const standalonePricing = useMemo(() => {
    return basePricing.find((p) => !p.job_type_field_config_id);
  }, [basePricing]);

  const fieldBasedPricingMap = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        customer_base_price: number;
        adjustment_type: "add" | "multiply";
      }
    > = {};
    basePricing
      .filter((p) => p.job_type_field_config_id)
      .forEach((p) => {
        if (p.job_type_value) {
          map[p.job_type_value] = {
            id: p.id,
            customer_base_price: p.customer_base_price,
            adjustment_type: p.adjustment_type,
          };
        }
      });
    return map;
  }, [basePricing]);

  const handlePriceChange = (key: string, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [key]: value,
    }));
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
      await upsertPricing({
        standalone_base_price: adjustmentType === "add" ? customerPrice : 0,
        customer_base_price: customerPrice,
        adjustment_type: adjustmentType,
      });
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

    const adjustmentType =
      editingAdjustmentTypes[optionValue] ||
      fieldBasedPricingMap[optionValue]?.adjustment_type ||
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
      <Card>
        <CardHeader>
          <CardTitle>Base Pricing Type</CardTitle>
          <CardDescription>
            Choose whether base pricing is a fixed amount or varies by job type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Field-Based Pricing</Label>
              <p className="text-sm text-muted-foreground">
                Base price varies by job type (e.g., Installation vs
                Maintenance)
              </p>
            </div>
            <Switch checked={isFieldBased} onCheckedChange={setIsFieldBased} />
          </div>
        </CardContent>
      </Card>

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
              {standalonePricing && (
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
                ) : standalonePricing ? (
                  "Update"
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field-Based Base Pricing */}
      {isFieldBased && (
        <Card>
          <CardHeader>
            <CardTitle>Field-Based Base Pricing</CardTitle>
            <CardDescription>
              Set base prices for each job type option
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Equation Preview */}
            <div className="bg-muted/50 rounded-md p-2 text-sm">
              <span className="text-muted-foreground">Equation: </span>
              <span className="font-mono font-medium">
                Total = adjustment[job_type] applied to invoice
              </span>
            </div>

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
                  const existingPricing = fieldBasedPricingMap[optionValue];
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
                          {existingPricing && (
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
