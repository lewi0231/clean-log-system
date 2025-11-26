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
import type { FieldConfig } from "@/shared/types";
import { DollarSign, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

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

  // Filter to only number-type field configs
  const numberFieldConfigs = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "number");
  }, [fieldConfigs]);

  // Create a map of field_config_id -> pricing for quick lookup
  const pricingMap = useMemo(() => {
    const map: Record<string, { id: string; unit_price: number }> = {};
    fieldPricing.forEach((p) => {
      map[p.field_config_id] = {
        id: p.id,
        unit_price: p.unit_price,
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

    const unitPrice = parseFloat(priceValue);
    if (isNaN(unitPrice) || unitPrice < 0) {
      return;
    }

    setSaving((prev) => ({ ...prev, [fieldConfig.id]: true }));
    try {
      await upsertPricing(fieldConfig.id, unitPrice);
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

  if (numberFieldConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Number Fields Available</CardTitle>
          <CardDescription>
            You need to create number-type field configurations in Mobile Config
            before you can set pricing for invoicing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {numberFieldConfigs.map((fieldConfig) => {
        const existingPricing = pricingMap[fieldConfig.id];
        const currentPrice =
          editingPrices[fieldConfig.id] !== undefined
            ? editingPrices[fieldConfig.id]
            : existingPricing
            ? existingPricing.unit_price.toString()
            : "";
        const hasChanges =
          editingPrices[fieldConfig.id] !== undefined &&
          editingPrices[fieldConfig.id] !==
            (existingPricing?.unit_price.toString() || "");
        const isSaving = saving[fieldConfig.id] || false;
        const isDeleting = deleting[fieldConfig.id] || false;

        return (
          <Card key={fieldConfig.id}>
            <CardHeader>
              <CardTitle className="text-lg">{fieldConfig.label}</CardTitle>
              <CardDescription>
                <span className="font-mono text-xs">{fieldConfig.name}</span>
                {fieldConfig.description && (
                  <span className="ml-2">{fieldConfig.description}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`price-${fieldConfig.id}`}>
                    Unit Price (USD)
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
