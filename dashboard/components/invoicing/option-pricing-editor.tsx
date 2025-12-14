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
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { useOptionPricing } from "@/hooks/use-option-pricing";
import type { FieldConfig } from "@clean-log/shared/types";
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
    useOptionPricing(fieldConfig.id, {
      locationId,
    });

  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer: string; worker: string }>
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Create a map of option_value -> pricing for quick lookup
  const pricingMap = useMemo(() => {
    const map: Record<
      string,
      { id: string; customer_price: number; worker_payment_rate: number | null }
    > = {};
    optionPricing.forEach((p) => {
      map[p.option_value] = {
        id: p.id,
        customer_price: p.customer_price,
        worker_payment_rate: p.worker_payment_rate,
      };
    });
    return map;
  }, [optionPricing]);

  const options = fieldConfig.options || [];

  const handlePriceChange = (
    optionValue: string,
    type: "customer" | "worker",
    value: string
  ) => {
    setEditingPrices((prev) => ({
      ...prev,
      [optionValue]: {
        ...prev[optionValue],
        [type]: value,
      },
    }));
  };

  const handleSave = async (optionValue: string) => {
    const editing = editingPrices[optionValue];
    if (!editing) return;

    const customerPrice = parseFloat(editing.customer);
    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }

    const workerPrice =
      editing.worker && editing.worker.trim() !== ""
        ? parseFloat(editing.worker)
        : null;

    if (workerPrice !== null && (isNaN(workerPrice) || workerPrice < 0)) {
      return;
    }

    setSaving((prev) => ({ ...prev, [optionValue]: true }));
    try {
      await upsertPricing(fieldConfig.id, optionValue, customerPrice, {
        workerPaymentRate: workerPrice,
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
    return <TableSkeleton rows={5} columns={3} />;
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

  return (
    <div className="space-y-3">
      {options.map((optionValue) => {
        const existingPricing = pricingMap[optionValue];
        const editing = editingPrices[optionValue];
        const currentCustomerPrice =
          editing?.customer !== undefined
            ? editing.customer
            : existingPricing
            ? existingPricing.customer_price.toString()
            : "";
        const currentWorkerPrice =
          editing?.worker !== undefined
            ? editing.worker
            : existingPricing?.worker_payment_rate !== null &&
              existingPricing?.worker_payment_rate !== undefined
            ? existingPricing.worker_payment_rate.toString()
            : "";

        const hasChanges =
          editing !== undefined &&
          (editing.customer !==
            (existingPricing?.customer_price.toString() || "") ||
            editing.worker !==
              (existingPricing?.worker_payment_rate?.toString() || ""));

        const isSaving = saving[optionValue] || false;
        const isDeleting = deleting[optionValue] || false;

        return (
          <Card key={optionValue} className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">{optionValue}</Label>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label
                      htmlFor={`customer-${optionValue}`}
                      className="text-xs"
                    >
                      Customer Price (USD)
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`customer-${optionValue}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={currentCustomerPrice}
                        onChange={(e) =>
                          handlePriceChange(
                            optionValue,
                            "customer",
                            e.target.value
                          )
                        }
                        className="pl-7 h-9 text-sm"
                        disabled={isSaving || isDeleting}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`worker-${optionValue}`}
                      className="text-xs"
                    >
                      Worker Rate (USD){" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`worker-${optionValue}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={currentWorkerPrice}
                        onChange={(e) =>
                          handlePriceChange(
                            optionValue,
                            "worker",
                            e.target.value
                          )
                        }
                        className="pl-7 h-9 text-sm"
                        disabled={isSaving || isDeleting}
                      />
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave(optionValue)}
                  disabled={
                    !hasChanges ||
                    !currentCustomerPrice ||
                    isNaN(parseFloat(currentCustomerPrice)) ||
                    parseFloat(currentCustomerPrice) < 0 ||
                    (currentWorkerPrice &&
                      (isNaN(parseFloat(currentWorkerPrice)) ||
                        parseFloat(currentWorkerPrice) < 0)) ||
                    isSaving ||
                    isDeleting
                  }
                  className="w-full"
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
