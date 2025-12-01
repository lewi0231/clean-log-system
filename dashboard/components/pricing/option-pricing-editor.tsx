"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { useOptionPricing } from "@/hooks/use-option-pricing";
import type { FieldConfig } from "@/shared/types";
import { DollarSign, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

interface OptionPricingEditorProps {
  fieldConfig: FieldConfig;
  locationId?: string | null;
}

export default function OptionPricingEditor({
  fieldConfig,
  locationId,
}: OptionPricingEditorProps) {
  const { optionPricing, loading, error, upsertPricing, deletePricing } =
    useOptionPricing(fieldConfig.id, locationId);

  const [editingPrices, setEditingPrices] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Create a map of option_value -> pricing for quick lookup
  const pricingMap = useMemo(() => {
    const map: Record<string, { id: string; customer_price: number }> = {};
    optionPricing.forEach((p) => {
      map[p.option_value] = {
        id: p.id,
        customer_price: p.customer_price,
      };
    });
    return map;
  }, [optionPricing]);

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

  const handleDelete = async (optionValue: string, pricingId: string) => {
    setDeleting((prev) => ({ ...prev, [optionValue]: true }));
    try {
      await deletePricing(pricingId);
    } catch (error) {
      console.error("Failed to delete option pricing", error);
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[optionValue];
        return next;
      });
    }
  };

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
      : "Total = sum of selected option prices";

  return (
    <div className="space-y-3">
      {/* Equation Preview */}
      <div className="bg-muted/50 rounded-md p-2 text-sm mb-4">
        <span className="text-muted-foreground">Equation: </span>
        <span className="font-mono font-medium">{equationPreview}</span>
      </div>

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
          const isDeleting = deleting[optionValue] || false;

          return (
            <div
              key={optionValue}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <div className="flex-1">
                <Label className="font-medium text-sm">{optionValue}</Label>
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
                    disabled={isSaving || isDeleting}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {existingPricing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDelete(optionValue, existingPricing.id)
                    }
                    disabled={isSaving || isDeleting}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSave(optionValue)}
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
                      <Save className="mr-2 h-3 w-3" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
