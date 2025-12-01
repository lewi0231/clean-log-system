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
import type { FieldConfig, FieldType } from "@/shared/types";
import { DollarSign, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

// Field types that support pricing (only number and boolean - select and grouped_breakdown use option pricing)
const PRICING_SUPPORTED_TYPES: FieldType[] = ["number", "boolean"];

// Helper to get equation preview for field type
const getEquationPreview = (fieldType: FieldType): string => {
  switch (fieldType) {
    case "number":
      return "Total = price_per_unit × quantity";
    case "boolean":
      return "Total = base_price (when field is true)";
    default:
      return "";
  }
};

export default function FieldPricingList() {
  const { fieldConfigs, loading: configsLoading } = useFieldConfigs();
  const {
    fieldPricing,
    loading: pricingLoading,
    error: pricingError,
    upsertPricing,
    deletePricing,
  } = useFieldPricing();

  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

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

  const getFieldTypeDescription = (fieldConfig: FieldConfig): string => {
    switch (fieldConfig.field_type) {
      case "number":
        return "Price per unit. Multiply by the quantity entered in the field.";
      case "boolean":
        return "Fixed price charged when this field is checked.";
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
            Create number or boolean field configurations in Mobile Application
            to set pricing. Select and grouped breakdown fields use option
            pricing instead.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
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

        return (
          <Card key={fieldConfig.id} className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="font-semibold text-base">
                        {fieldConfig.label}
                      </Label>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({fieldConfig.field_type})
                      </span>
                    </div>
                    {fieldConfig.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {fieldConfig.description}
                      </p>
                    )}
                  </div>
                  {existingPricing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleDelete(fieldConfig.id, existingPricing.id)
                      }
                      disabled={isSaving || isDeleting}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Equation Preview */}
                <div className="bg-muted/50 rounded-md p-2 text-sm">
                  <span className="text-muted-foreground">Equation: </span>
                  <span className="font-mono font-medium">
                    {getEquationPreview(fieldConfig.field_type)}
                  </span>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label
                      htmlFor={`price-${fieldConfig.id}`}
                      className="text-sm"
                    >
                      Price per Unit (USD)
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                        className="pl-8"
                        disabled={isSaving || isDeleting}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getFieldTypeDescription(fieldConfig)}
                    </p>
                  </div>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
