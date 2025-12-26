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
import { Switch } from "@/components/ui/switch";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useServicePricingMode } from "@/hooks/use-service-pricing-mode";
import { useWorkers } from "@/hooks/use-workers";
import { log } from "@/lib/logger";
import type { ServicePricingMode } from "@/lib/types";
import type { FieldConfig } from "@clean-log/shared";
import { DollarSign, Info, Save } from "lucide-react";
import Link from "next/link";
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
  const { servicePricingModes, loading, error, upsertPricingMode, refetch } =
    useServicePricingMode({
      locationId,
    });
  const { currency: orgCurrency } = useOrganizationCurrency();
  const { workers } = useWorkers();
  const hasWorkers = workers.length > 0;

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
      }
    >
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
    };
  };

  const updateEditingState = (
    fieldConfigId: string,
    optionValue: string,
    updates: Partial<{
      customerPrice: string;
      workerPayment: string;
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

  const handleSaveField = async (fieldConfig: FieldConfig) => {
    const options = fieldConfig.options || [];
    const isFixedForField = fieldFixedToggles[fieldConfig.id] ?? false;
    const fieldKey = fieldConfig.id;

    setSaving((prev) => ({ ...prev, [fieldKey]: true }));

    try {
      // Save all options for this field
      await Promise.all(
        options.map(async (optionValue) => {
          const state = getEditingState(fieldConfig.id, optionValue);

          // Validate price inputs
          const customerPrice = parseFloat(state.customerPrice);
          const workerPayment = parseFloat(state.workerPayment);

          if (isNaN(customerPrice) || customerPrice < 0) {
            return;
          }
          if (hasWorkers && (isNaN(workerPayment) || workerPayment < 0)) {
            return;
          }

          // If prices are entered, always use fixed_price mode
          // The toggle determines if ALL options in the field use fixed pricing
          // but individual options with prices should always be fixed_price
          const shouldUseFixedPrice = isFixedForField || customerPrice > 0;

          await upsertPricingMode(
            fieldConfig.id,
            optionValue,
            shouldUseFixedPrice ? "fixed_price" : "field_based",
            {
              fixedCustomerPrice: customerPrice,
              fixedWorkerPayment: hasWorkers ? workerPayment : 0,
              fixedPriceCurrency: orgCurrency,
              locationId,
            }
          );
        })
      );

      // Wait for the query to refetch so the saved values appear
      await refetch();

      // Clear editing states after refetch completes
      options.forEach((optionValue) => {
        const key = `${fieldConfig.id}:${optionValue}`;
        setEditingStates((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      });
    } catch (error) {
      log.error("Failed to save service pricing modes", {
        error: error instanceof Error ? error.message : "Unknown error",
        fieldConfigId: fieldConfig.id,
      });
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={4} />;
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
            To configure service-type pricing, you need to add select fields to
            your mobile app forms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/mobile-config" className="cursor-pointer">
              <Button variant="outline" size="sm">
                Go to Mobile App Configuration
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {hasAnyFixedPricing && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Info className="h-5 w-5 text-primary" />
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
              <div className="space-y-3">
                {options.map((optionValue) => {
                  const state = getEditingState(fieldConfig.id, optionValue);
                  const key = `${fieldConfig.id}:${optionValue}`;
                  const isSavingField = saving[fieldConfig.id];

                  return (
                    <div
                      key={optionValue}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <Label className="font-medium text-sm">
                          {optionValue}
                        </Label>
                      </div>
                      <div
                        className={`grid gap-3 ${
                          hasWorkers ? "grid-cols-2" : "grid-cols-1"
                        }`}
                      >
                        <div className="space-y-1.5 min-w-[140px]">
                          <Label
                            htmlFor={`customer-${key}`}
                            className="text-xs text-muted-foreground"
                          >
                            Customer Price ({orgCurrency})
                          </Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
                              className="pl-7 h-9 text-sm"
                              disabled={isSavingField}
                            />
                          </div>
                        </div>

                        {hasWorkers && (
                          <div className="space-y-1.5 min-w-[140px]">
                            <Label
                              htmlFor={`worker-${key}`}
                              className="text-xs text-muted-foreground"
                            >
                              Worker Payment ({orgCurrency})
                            </Label>
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
                                className="pl-7 h-9 text-sm"
                                disabled={isSavingField}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-4 border-t">
                <Button
                  size="sm"
                  onClick={() => handleSaveField(fieldConfig)}
                  disabled={saving[fieldConfig.id]}
                  className="cursor-pointer"
                >
                  {saving[fieldConfig.id] ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save All Options
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
