"use client";

import { PricingService } from "@/lib/services";
import type { OptionPricing, PricingRule } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseOptionPricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
}

interface UseOptionPricingResult {
  optionPricing: OptionPricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (
    fieldConfigId: string,
    optionValue: string,
    customerPrice: number,
    options?: {
      workerPaymentRate?: number | null;
      locationId?: string | null;
      locationHierarchyId?: string | null;
      currency?: string;
      expirationDate?: string | null;
      pricingContext?: "customer" | "worker";
    },
  ) => Promise<OptionPricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useOptionPricing(
  fieldConfigId?: string,
  filters?: UseOptionPricingOptions,
): UseOptionPricingResult {
  const { organizationId } = useOrganization();
  const [optionPricing, setOptionPricing] = useState<OptionPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptionPricing = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch ALL pricing for this field config to show all overrides
      // We'll filter by scope in the component for the main price display
      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["option"],
        field_config_id: fieldConfigId,
        // Don't filter by location - fetch all to show all overrides
        location_hierarchy_id: null,
        location_id: null,
        effective_at: filters?.effectiveAt ?? undefined,
        pricing_context: filters?.pricingContext || "customer",
      });

      setOptionPricing(pricing.map(transformOptionRule));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch option pricing",
      );
      setOptionPricing([]);
    } finally {
      setLoading(false);
    }
  };

  const upsertPricing = async (
    fieldConfigId: string,
    optionValue: string,
    customerPrice: number,
    options?: {
      workerPaymentRate?: number | null;
      locationId?: string | null;
      locationHierarchyId?: string | null;
      currency?: string;
      expirationDate?: string | null;
      pricingContext?: "customer" | "worker";
    },
  ): Promise<OptionPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = options?.locationHierarchyId ??
      filters?.locationHierarchyId ?? null;
    const targetLocationId = options?.locationId ?? filters?.locationId ?? null;

    const existingPricing = optionPricing.find(
      (pricing) =>
        pricing.field_config_id === fieldConfigId &&
        pricing.option_value === optionValue &&
        (pricing.location_hierarchy_id || null) === targetLocationHierarchyId &&
        (pricing.location_id || null) === targetLocationId,
    );

    const pricing = await PricingService.upsertRule({
      id: existingPricing?.id,
      organization_id: organizationId,
      scope: "option",
      pricing_type: "fixed",
      pricing_context: options?.pricingContext || filters?.pricingContext ||
        "customer",
      field_config_id: fieldConfigId,
      option_value: optionValue,
      base_price: customerPrice,
      currency: options?.currency || "USD",
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      worker_payment_type: options?.workerPaymentRate
        ? "fixed_rate"
        : existingPricing?.worker_payment_type || null,
      worker_payment_value: options?.workerPaymentRate ?? null,
      expires_at: options?.expirationDate || null,
    });

    await fetchOptionPricing();
    return transformOptionRule(pricing);
  };

  const deletePricing = async (id: string): Promise<void> => {
    await PricingService.deleteRule(id);
    await fetchOptionPricing();
  };

  useEffect(() => {
    fetchOptionPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    organizationId,
    fieldConfigId,
    filters?.locationHierarchyId,
    filters?.locationId,
    filters?.effectiveAt,
  ]);

  return {
    optionPricing,
    loading,
    error,
    refetch: fetchOptionPricing,
    upsertPricing,
    deletePricing,
  };
}

const transformOptionRule = (rule: PricingRule): OptionPricing => ({
  id: rule.id,
  organization_id: rule.organization_id,
  field_config_id: rule.field_config_id || "",
  option_value: rule.option_value || "",
  customer_price: rule.base_price ?? 0,
  worker_payment_rate: rule.worker_payment_value ?? null,
  worker_payment_type: rule.worker_payment_type ?? null,
  location_id: rule.location_id,
  location_hierarchy_id: rule.location_hierarchy_id,
  currency: rule.currency,
  source_rule: rule,
  field_config: rule.field_config,
  location: rule.location,
  location_node: rule.location_node,
});
