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
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useFieldPricing } from "@/hooks/use-field-pricing";
import { useModeAwareLabels } from "@/hooks/use-mode-aware-labels";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import type { FieldConfig, FieldType } from "@clean-log/shared/types";
import { ChevronDown, ChevronUp, DollarSign, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

// Field types that support pricing
const PRICING_SUPPORTED_TYPES: FieldType[] = [
  "number",
  "select",
  "grouped_breakdown",
  "boolean",
];

export default function FieldPricingList() {
  const { fieldConfigs, loading: configsLoading } = useFieldConfigs();
  const {
    fieldPricing,
    loading: pricingLoading,
    error: pricingError,
    upsertPricing,
    deletePricing,
  } = useFieldPricing();
  const labels = useModeAwareLabels();
  const { settings } = useOrganizationSettings();
  const isServiceBased = settings?.business_mode === "service_based";

  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Filter to only field types that support pricing
  const pricingFieldConfigs = useMemo(() => {
    return fieldConfigs.filter((fc) =>
      PRICING_SUPPORTED_TYPES.includes(fc.field_type)
    );
  }, [fieldConfigs]);

  // Create a map of field_config_id -> pricing for quick lookup (default pricing only)
  const pricingMap = useMemo(() => {
    const map: Record<
      string,
      { id: string; customer_price: number; pricing_type: string }
    > = {};
    fieldPricing
      .filter((p) => !p.location_id) // Only default pricing
      .forEach((p) => {
        map[p.field_config_id] = {
          id: p.id,
          customer_price: p.customer_price,
          pricing_type: p.pricing_type,
        };
      });
    return map;
  }, [fieldPricing]);

  const handlePriceChange = (fieldConfigId: string, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [fieldConfigId]: value,
    }));
  };

  const handleSave = async (fieldConfig: FieldConfig) => {
    const priceValue = editingPrices[fieldConfig.id];
    if (!priceValue || priceValue.trim() === "") {
      return;
    }

    const customerPrice = parseFloat(priceValue);
    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }

    setSaving((prev) => ({ ...prev, [fieldConfig.id]: true }));
    try {
      await upsertPricing(fieldConfig.id, customerPrice, {
        appliesToFieldType: fieldConfig.field_type,
        pricingType: fieldConfig.field_type === "boolean" ? "fixed" : "unit",
      });
      setEditingPrices((prev) => {
        const next = { ...prev };
        delete next[fieldConfig.id];
        return next;
      });
    } catch (error) {
      console.error("Failed to save pricing", error);
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[fieldConfig.id];
        return next;
      });
    }
  };

  const handleDelete = async (fieldConfigId: string, pricingId: string) => {
    setDeleting((prev) => ({ ...prev, [fieldConfigId]: true }));
    try {
      await deletePricing(pricingId);
    } catch (error) {
      console.error("Failed to delete pricing", error);
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[fieldConfigId];
        return next;
      });
    }
  };

  const toggleExpand = (fieldConfigId: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldConfigId)) {
        next.delete(fieldConfigId);
      } else {
        next.add(fieldConfigId);
      }
      return next;
    });
  };

  const getFieldTypeLabel = (fieldType: FieldType): string => {
    switch (fieldType) {
      case "number":
        return isServiceBased ? "Service Price" : "Unit Cost";
      case "select":
        return isServiceBased ? "Service Price" : "Option Cost";
      case "grouped_breakdown":
        return isServiceBased ? "Service Price" : "Group/Brand Cost";
      case "boolean":
        return isServiceBased
          ? "Fixed Price (when true)"
          : "Fixed Cost (when true)";
      default:
        return labels.pricingLabel;
    }
  };

  const getFieldTypeDescription = (fieldConfig: FieldConfig): string => {
    switch (fieldConfig.field_type) {
      case "number":
        return isServiceBased
          ? "Price per unit (multiplied by quantity)"
          : "Cost per unit (multiplied by quantity)";
      case "select":
        return isServiceBased
          ? "Price for each selected option. Configure option-specific pricing in the Option Pricing section."
          : "Cost for each selected option. Configure option-specific pricing in the Option Pricing section.";
      case "grouped_breakdown":
        return isServiceBased
          ? "Price for each group/brand. Configure group-specific pricing in the Option Pricing section."
          : "Cost for each group/brand. Configure group-specific pricing in the Option Pricing section.";
      case "boolean":
        return isServiceBased
          ? "Fixed price charged when this field is true"
          : "Fixed cost charged when this field is true";
      default:
        return "";
    }
  };

  const loading = configsLoading || pricingLoading;

  if (loading) {
    return <LoadingState message="Loading field pricing..." />;
  }

  if (pricingError) {
    return (
      <div className="text-center py-8 text-destructive">
        Error: {pricingError}
      </div>
    );
  }

  if (pricingFieldConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Fields Available for Pricing</CardTitle>
          <CardDescription>
            You need to create field configurations (number, select, grouped
            breakdown, or boolean types) in Mobile Application before you can
            set pricing for invoicing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pricingFieldConfigs.map((fieldConfig) => {
        const existingPricing = pricingMap[fieldConfig.id];
        const currentPrice =
          editingPrices[fieldConfig.id] !== undefined
            ? editingPrices[fieldConfig.id]
            : existingPricing
            ? existingPricing.customer_price.toString()
            : "";
        const hasChanges =
          editingPrices[fieldConfig.id] !== undefined &&
          editingPrices[fieldConfig.id] !==
            (existingPricing?.customer_price.toString() || "");
        const isSaving = saving[fieldConfig.id] || false;
        const isDeleting = deleting[fieldConfig.id] || false;
        const isExpanded = expandedFields.has(fieldConfig.id);

        return (
          <Card key={fieldConfig.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{fieldConfig.label}</CardTitle>
                  <CardDescription className="mt-1">
                    <span className="font-mono text-xs">
                      {fieldConfig.name}
                    </span>
                    <span className="ml-2 text-xs">
                      ({fieldConfig.field_type})
                    </span>
                    {fieldConfig.description && (
                      <span className="ml-2">{fieldConfig.description}</span>
                    )}
                  </CardDescription>
                </div>
                {(fieldConfig.field_type === "select" ||
                  fieldConfig.field_type === "grouped_breakdown") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleExpand(fieldConfig.id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`price-${fieldConfig.id}`}>
                      {getFieldTypeLabel(fieldConfig.field_type)} (USD)
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`price-${fieldConfig.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={currentPrice}
                        onChange={(e) =>
                          handlePriceChange(fieldConfig.id, e.target.value)
                        }
                        className="pl-9"
                        disabled={isSaving || isDeleting}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getFieldTypeDescription(fieldConfig)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {existingPricing && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleDelete(fieldConfig.id, existingPricing.id)
                        }
                        disabled={isSaving || isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSave(fieldConfig)}
                      disabled={
                        !hasChanges ||
                        !currentPrice ||
                        isNaN(parseFloat(currentPrice)) ||
                        parseFloat(currentPrice) < 0 ||
                        isSaving ||
                        isDeleting
                      }
                    >
                      {isSaving ? (
                        "Saving..."
                      ) : existingPricing ? (
                        "Update"
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Show options for select/grouped_breakdown when expanded */}
                {(fieldConfig.field_type === "select" ||
                  fieldConfig.field_type === "grouped_breakdown") &&
                  isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">
                        {fieldConfig.field_type === "select"
                          ? "Options:"
                          : "Groups/Brands:"}
                      </p>
                      <div className="space-y-2">
                        {fieldConfig.options &&
                        fieldConfig.options.length > 0 ? (
                          fieldConfig.options.map((option) => (
                            <div
                              key={option}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="font-medium">{option}</span>
                              <span className="text-muted-foreground">
                                (Configure option-specific pricing in Option
                                Pricing section)
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No options configured
                          </p>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
