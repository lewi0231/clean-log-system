"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { DollarSign, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

interface BasePricingEditorProps {
  locationId?: string | null;
}

export default function BasePricingEditor({ locationId }: BasePricingEditorProps) {
  const { organizationId } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();
  const { basePricing, loading, error, upsertPricing, deletePricing } = useBasePricing(
    organizationId,
    { locationId }
  );

  const [isFieldBased, setIsFieldBased] = useState(true);
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<string | null>(null);
  const [editingPrices, setEditingPrices] = useState<
    Record<string, { customer: string; worker: string }>
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
        worker_base_payment: number | null;
      }
    > = {};
    basePricing
      .filter((p) => p.job_type_field_config_id)
      .forEach((p) => {
        if (p.job_type_value) {
          map[p.job_type_value] = {
            id: p.id,
            customer_base_price: p.customer_base_price,
            worker_base_payment: p.worker_base_payment,
          };
        }
      });
    return map;
  }, [basePricing]);

  const handlePriceChange = (key: string, type: "customer" | "worker", value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [type]: value,
      },
    }));
  };

  const handleSaveStandalone = async () => {
    const editing = editingPrices["standalone"];
    if (!editing) return;

    const customerPrice = parseFloat(editing.customer);
    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }

    const workerPrice =
      editing.worker && editing.worker.trim() !== "" ? parseFloat(editing.worker) : null;

    if (workerPrice !== null && (isNaN(workerPrice) || workerPrice < 0)) {
      return;
    }

    setSaving((prev) => ({ ...prev, standalone: true }));
    try {
      await upsertPricing({
        standalone_base_price: customerPrice,
        customer_base_price: customerPrice,
        worker_base_payment: workerPrice,
      });
      setEditingPrices((prev) => {
        const next = { ...prev };
        delete next.standalone;
        return next;
      });
    } catch (error) {
      log.error("Failed to save standalone base pricing", error);
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
    if (!editing) return;

    const customerPrice = parseFloat(editing.customer);
    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }

    const workerPrice =
      editing.worker && editing.worker.trim() !== "" ? parseFloat(editing.worker) : null;

    if (workerPrice !== null && (isNaN(workerPrice) || workerPrice < 0)) {
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
        worker_base_payment: workerPrice,
      });
      setEditingPrices((prev) => {
        const next = { ...prev };
        delete next[optionValue];
        return next;
      });
    } catch (error) {
      log.error("Failed to save field-based base pricing", error);
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
      log.error("Failed to delete base pricing", error);
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

  const selectedFieldOptions = useMemo(() => {
    return selectedFieldConfig?.options ?? null;
  }, [selectedFieldConfig]);

  if (loading) {
    return <FormSkeleton fields={4} />;
  }

  if (error) {
    return <div className="text-center py-4 text-destructive">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Toggle between field-based and standalone */}
      <Card>
        <CardHeader>
          <CardTitle>Base Pricing Type</CardTitle>
          <CardDescription>
            Choose whether base pricing is tied to a field or standalone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Field-Based Pricing</Label>
              <p className="text-sm text-muted-foreground">
                Base price varies by job type (e.g., Installation vs Maintenance)
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
            <CardTitle>Standalone Base Price</CardTitle>
            <CardDescription>A fixed base price applied to all jobs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="standalone-customer">Customer Base Price (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="standalone-customer"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={
                      editingPrices["standalone"]?.customer !== undefined
                        ? editingPrices["standalone"].customer
                        : standalonePricing
                          ? standalonePricing.customer_base_price.toString()
                          : ""
                    }
                    onChange={(e) => handlePriceChange("standalone", "customer", e.target.value)}
                    className="pl-9"
                    disabled={saving["standalone"] || deleting[standalonePricing?.id || ""]}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="standalone-worker">
                  Worker Base Payment (USD){" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="standalone-worker"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={
                      editingPrices["standalone"]?.worker !== undefined
                        ? editingPrices["standalone"].worker
                        : standalonePricing?.worker_base_payment !== null &&
                            standalonePricing?.worker_base_payment !== undefined
                          ? standalonePricing.worker_base_payment.toString()
                          : ""
                    }
                    onChange={(e) => handlePriceChange("standalone", "worker", e.target.value)}
                    className="pl-9"
                    disabled={saving["standalone"] || deleting[standalonePricing?.id || ""]}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {standalonePricing && (
                <Button
                  variant="outline"
                  onClick={() => handleDelete(standalonePricing.id)}
                  disabled={saving["standalone"] || deleting[standalonePricing.id]}
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
            <CardDescription>Set base prices for each job type option</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field-select">Select Field</Label>
              <Select value={selectedFieldConfigId || ""} onValueChange={setSelectedFieldConfigId}>
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

            {selectedFieldConfig && selectedFieldOptions && (
              <div className="space-y-3">
                {selectedFieldOptions.map((optionValue: string) => {
                  const existingPricing = fieldBasedPricingMap[optionValue];
                  const editing = editingPrices[optionValue];
                  const currentCustomerPrice =
                    editing?.customer !== undefined
                      ? editing.customer
                      : existingPricing
                        ? existingPricing.customer_base_price.toString()
                        : "";
                  const currentWorkerPrice =
                    editing?.worker !== undefined
                      ? editing.worker
                      : existingPricing?.worker_base_payment !== null &&
                          existingPricing?.worker_base_payment !== undefined
                        ? existingPricing.worker_base_payment.toString()
                        : "";

                  const hasChanges =
                    editing !== undefined &&
                    (editing.customer !== (existingPricing?.customer_base_price.toString() || "") ||
                      editing.worker !== (existingPricing?.worker_base_payment?.toString() || ""));

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
                                onClick={() => handleDelete(existingPricing.id)}
                                disabled={saving[optionValue] || deleting[existingPricing.id]}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Customer Base Price (USD)</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={currentCustomerPrice}
                                  onChange={(e) =>
                                    handlePriceChange(optionValue, "customer", e.target.value)
                                  }
                                  className="pl-7 h-9 text-sm"
                                  disabled={
                                    saving[optionValue] || deleting[existingPricing?.id || ""]
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">
                                Worker Base Payment (USD){" "}
                                <span className="text-muted-foreground">(optional)</span>
                              </Label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={currentWorkerPrice}
                                  onChange={(e) =>
                                    handlePriceChange(optionValue, "worker", e.target.value)
                                  }
                                  className="pl-7 h-9 text-sm"
                                  disabled={
                                    saving[optionValue] || deleting[existingPricing?.id || ""]
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveFieldBased(optionValue)}
                            disabled={
                              !hasChanges ||
                              !currentCustomerPrice ||
                              isNaN(parseFloat(currentCustomerPrice)) ||
                              parseFloat(currentCustomerPrice) < 0 ||
                              (currentWorkerPrice &&
                                (isNaN(parseFloat(currentWorkerPrice)) ||
                                  parseFloat(currentWorkerPrice) < 0)) ||
                              saving[optionValue] ||
                              deleting[existingPricing?.id || ""]
                            }
                            className="w-full"
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
                      </CardContent>
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
