"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldConfig } from "@clean-log/shared";
import { DollarSign } from "lucide-react";

interface FieldPriceInputProps {
  fieldConfig: FieldConfig;
  currentCustomerPrice: string;
  currentWorkerPrice: string;
  showBothContexts: boolean;
  pricingContext: "customer" | "worker";
  isSaving: boolean;
  onPriceChange: (fieldId: string, value: string, context: "customer" | "worker") => void;
}

const getFieldTypeDescription = (fieldConfig: FieldConfig): string => {
  switch (fieldConfig.field_type) {
    case "number":
      return "Price multiplied by the field value";
    case "boolean":
      return "Price applied when field is true";
    default:
      return "";
  }
};

export function FieldPriceInput({
  fieldConfig,
  currentCustomerPrice,
  currentWorkerPrice,
  showBothContexts,
  pricingContext,
  isSaving,
  onPriceChange,
}: FieldPriceInputProps) {
  if (showBothContexts) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor={`customer-price-${fieldConfig.id}`}
            className="text-sm"
          >
            Customer Price per Unit
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`customer-price-${fieldConfig.id}`}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={currentCustomerPrice}
              onChange={(e) =>
                onPriceChange(fieldConfig.id, e.target.value, "customer")
              }
              className="pl-8"
              disabled={isSaving}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {getFieldTypeDescription(fieldConfig)}
          </p>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor={`worker-price-${fieldConfig.id}`}
            className="text-sm"
          >
            Worker Payment per Unit
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`worker-price-${fieldConfig.id}`}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={currentWorkerPrice}
              onChange={(e) =>
                onPriceChange(fieldConfig.id, e.target.value, "worker")
              }
              className="pl-8"
              disabled={isSaving}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Payment rate for workers
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[2fr_minmax(0,1fr)]">
      <div className="space-y-2">
        <Label htmlFor={`price-${fieldConfig.id}`} className="text-sm">
          {pricingContext === "customer"
            ? "Price per Unit"
            : "Payment per Unit"}
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`price-${fieldConfig.id}`}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={
              pricingContext === "customer"
                ? currentCustomerPrice
                : currentWorkerPrice
            }
            onChange={(e) =>
              onPriceChange(fieldConfig.id, e.target.value, pricingContext)
            }
            className="pl-8"
            disabled={isSaving}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {getFieldTypeDescription(fieldConfig)}
        </p>
      </div>
    </div>
  );
}

