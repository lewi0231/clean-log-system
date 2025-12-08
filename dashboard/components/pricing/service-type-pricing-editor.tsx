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
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useServicePricingMode } from "@/hooks/use-service-pricing-mode";
import type { ServicePricingMode } from "@/lib/types";
import type { FieldConfig } from "@clean-log/shared";
import { DollarSign, Info, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ServiceTypePricingEditorProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
}

export default function ServiceTypePricingEditor({
  locationId = null,
}: ServiceTypePricingEditorProps) {
  const { fieldConfigs } = useFieldConfigs();
  const {
    servicePricingModes,
    loading,
    error,
    upsertPricingMode,
    deletePricingMode,
  } = useServicePricingMode({
    locationId,
  });
  const { currency: orgCurrency } = useOrganizationCurrency();

  // Filter to only select-type fields
  const selectFieldConfigs = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "select");
  }, [fieldConfigs]);

  // Create a map of (fieldConfigId, optionValue) -> ServicePricingMode
  const pricingModeMap = useMemo(() => {
    const map = new Map<string, ServicePricingMode>();
    servicePricingModes.forEach((mode) => {
      const key = `${mode.service_type_field_config_id}:${mode.service_type_value}`;
      map.set(key, mode);
    });
    return map;
  }, [servicePricingModes]);

  const [fieldFixedToggles, setFieldFixedToggles] = useState<
    Record<string, boolean>
  >({});

  const [editingStates, setEditingStates] = useState<
    Record<
      string,
      {
        customerPrice: string;
        workerPayment: string;
        currency: string;
      }
    >
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Initialize field-level fixed toggles from persisted pricing modes
  useEffect(() => {
    const next: Record<string, boolean> = {};
    selectFieldConfigs.forEach((fc) => {
      const hasFixed = servicePricingModes.some(
        (mode) =>
          mode.service_type_field_config_id === fc.id &&
          mode.pricing_mode === "fixed_price"
      );
      next[fc.id] = hasFixed;
    });

    setFieldFixedToggles((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((k) => prev[k] === next[k])
      ) {
        return prev;
      }
      return next;
    });
  }, [selectFieldConfigs, servicePricingModes]);

  const hasAnyFixedPricing = useMemo(() => {
    return Object.values(fieldFixedToggles).some(Boolean);
  }, [fieldFixedToggles]);

  const getEditingState = (
    fieldConfigId: string,
    optionValue: string
  ): {
    customerPrice: string;
    workerPayment: string;
    currency: string;
  } => {
    const key = `${fieldConfigId}:${optionValue}`;
    const existing = pricingModeMap.get(key);
    const editing = editingStates[key];

    if (editing) {
      return editing;
    }

    return {
      customerPrice: existing?.fixed_customer_price?.toString() || "",
      workerPayment: existing?.fixed_worker_payment?.toString() || "",
      currency: existing?.fixed_price_currency || orgCurrency || "USD",
    };
  };

  const updateEditingState = (
    fieldConfigId: string,
    optionValue: string,
    updates: Partial<{
      customerPrice: string;
      workerPayment: string;
      currency: string;
    }>
  ) => {
    const key = `${fieldConfigId}:${optionValue}`;
    setEditingStates((prev) => ({
      ...prev,
      [key]: {
        ...getEditingState(fieldConfigId, optionValue),
        ...updates,
      },
    }));
  };

  const handleFieldFixedToggle = (fieldConfigId: string, enabled: boolean) => {
    setFieldFixedToggles((prev) => ({
      ...prev,
      [fieldConfigId]: enabled,
    }));
  };

  const handleSave = async (fieldConfig: FieldConfig, optionValue: string) => {
    const state = getEditingState(fieldConfig.id, optionValue);
    const key = `${fieldConfig.id}:${optionValue}`;
    const isFixedForField = fieldFixedToggles[fieldConfig.id] ?? false;

    // Validate price inputs
    const customerPrice = parseFloat(state.customerPrice);
    const workerPayment = parseFloat(state.workerPayment);

    if (isNaN(customerPrice) || customerPrice < 0) {
      return;
    }
    if (isNaN(workerPayment) || workerPayment < 0) {
      return;
    }

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await upsertPricingMode(
        fieldConfig.id,
        optionValue,
        isFixedForField ? "fixed_price" : "field_based",
        {
          fixedCustomerPrice: customerPrice,
          fixedWorkerPayment: workerPayment,
          fixedPriceCurrency: state.currency,
          locationId,
        }
      );
      setEditingStates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      console.error("Failed to save service pricing mode", error);
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleDelete = async (fieldConfigId: string, optionValue: string) => {
    const key = `${fieldConfigId}:${optionValue}`;
    const existing = pricingModeMap.get(key);
    if (!existing) return;

    setDeleting((prev) => ({ ...prev, [key]: true }));
    try {
      await deletePricingMode(existing.id);
      setEditingStates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      console.error("Failed to delete service pricing mode", err);
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  if (loading) {
    return <LoadingState message="Loading service pricing modes..." />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (selectFieldConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Select Fields</CardTitle>
          <CardDescription>
            Create select fields in Mobile Application to configure service-type
            pricing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {hasAnyFixedPricing && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">
                  Fixed Pricing Mode Enabled
                </p>
                <p className="text-xs text-muted-foreground">
                  When fixed pricing is enabled for a service type, it takes
                  precedence over all other pricing rules. The pricing hierarchy
                  is:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>
                    <strong>Location Fixed Pricing</strong> (highest priority) -
                    Applies to all jobs at the location
                  </li>
                  <li>
                    <strong>Service-Type Fixed Pricing</strong> - Bypasses
                    field-based calculations for that service type
                  </li>
                  <li>
                    <strong>Field-Based Pricing</strong> - Field pricing, option
                    pricing, and base pricing rules
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  When a location has fixed pricing, all other pricing is
                  ignored. When a service type is fixed, other pricing tabs do
                  not affect that service type.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectFieldConfigs.map((fieldConfig) => {
        const options = fieldConfig.options || [];
        if (options.length === 0) {
          return null;
        }

        return (
          <Card key={fieldConfig.id}>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{fieldConfig.label}</CardTitle>
                <CardDescription>
                  Configure pricing for each service type option. Use the toggle
                  to apply fixed pricing for all options in this field.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`field-toggle-${fieldConfig.id}`}
                  className="text-sm text-muted-foreground"
                >
                  Use fixed pricing for this field
                </Label>
                <Switch
                  id={`field-toggle-${fieldConfig.id}`}
                  checked={fieldFixedToggles[fieldConfig.id] ?? false}
                  onCheckedChange={(checked) =>
                    handleFieldFixedToggle(fieldConfig.id, checked)
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {options.map((optionValue) => {
                  const state = getEditingState(fieldConfig.id, optionValue);
                  const key = `${fieldConfig.id}:${optionValue}`;
                  const existing = pricingModeMap.get(key);
                  const isSaving = saving[key];
                  const isDeleting = deleting[key];

                  return (
                    <div
                      key={optionValue}
                      className="flex items-start gap-4 rounded-lg border p-4"
                    >
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">{optionValue}</Label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`customer-${key}`}>
                              Customer Price
                            </Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id={`customer-${key}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={state.customerPrice}
                                onChange={(e) =>
                                  updateEditingState(
                                    fieldConfig.id,
                                    optionValue,
                                    { customerPrice: e.target.value }
                                  )
                                }
                                placeholder="0.00"
                                className="pl-9"
                                disabled={isSaving || isDeleting}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`worker-${key}`}>
                              Worker Payment
                            </Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id={`worker-${key}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={state.workerPayment}
                                onChange={(e) =>
                                  updateEditingState(
                                    fieldConfig.id,
                                    optionValue,
                                    { workerPayment: e.target.value }
                                  )
                                }
                                placeholder="0.00"
                                className="pl-9"
                                disabled={isSaving || isDeleting}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`currency-${key}`}>Currency</Label>
                            <Select
                              value={state.currency}
                              onValueChange={(value) =>
                                updateEditingState(
                                  fieldConfig.id,
                                  optionValue,
                                  { currency: value }
                                )
                              }
                              disabled={isSaving || isDeleting}
                            >
                              <SelectTrigger id={`currency-${key}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="AUD">AUD</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="CAD">CAD</SelectItem>
                                <SelectItem value="NZD">NZD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          {existing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDelete(fieldConfig.id, optionValue)
                              }
                              disabled={isSaving || isDeleting}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Remove pricing
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleSave(fieldConfig, optionValue)}
                            disabled={
                              isSaving ||
                              isDeleting ||
                              !state.customerPrice ||
                              !state.workerPayment
                            }
                          >
                            {isSaving ? (
                              "Saving..."
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
