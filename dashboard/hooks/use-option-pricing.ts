"use client";

import { PricingService } from "@/lib/services";
import type { UpsertPricingRuleRequest } from "@/lib/services/pricing.service";
import type { OptionPricing, PricingRule } from "@/lib/types";
import { useEffect, useState } from "react";

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
      effectiveAt?: string | null; // Explicit effective date for timeline support
      pricingContext?: "customer" | "worker";
      skipRefetch?: boolean;
    },
  ) => Promise<OptionPricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useOptionPricing(
  organizationId: string | null,
  fieldConfigId?: string,
  filters?: UseOptionPricingOptions,
): UseOptionPricingResult {
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
      effectiveAt?: string | null; // Explicit effective date for timeline support
      pricingContext?: "customer" | "worker";
      skipRefetch?: boolean;
    },
  ): Promise<OptionPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = options?.locationHierarchyId ??
      filters?.locationHierarchyId ?? null;
    const targetLocationId = options?.locationId ?? filters?.locationId ?? null;
    const targetPricingContext = options?.pricingContext ||
      filters?.pricingContext || "customer";

    // Determine the target effective date
    // IMPORTANT: Don't use new Date() parsing for date-only strings as it causes timezone issues
    let targetEffectiveAt: string;
    let targetEffectiveDate: string; // YYYY-MM-DD for comparison

    if (options?.effectiveAt) {
      // Check if it's already a date-only string (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(options.effectiveAt)) {
        targetEffectiveDate = options.effectiveAt;
        targetEffectiveAt = `${options.effectiveAt}T00:00:00.000Z`;
      } else {
        targetEffectiveAt = new Date(options.effectiveAt).toISOString();
        targetEffectiveDate = targetEffectiveAt.split("T")[0];
      }
    } else {
      // No date specified - use current timestamp
      targetEffectiveAt = new Date().toISOString();
      targetEffectiveDate = targetEffectiveAt.split("T")[0];
    }

    // Find existing rule matching field, option, location, context, AND effective date
    const existingPricing = optionPricing.find(
      (pricing) => {
        const ruleContext = pricing.source_rule?.pricing_context || "customer";
        const ruleEffectiveDate = pricing.source_rule?.effective_at
          ? new Date(pricing.source_rule.effective_at).toISOString().split(
            "T",
          )[0]
          : null;
        return (
          pricing.field_config_id === fieldConfigId &&
          pricing.option_value === optionValue &&
          (pricing.location_hierarchy_id || null) ===
            targetLocationHierarchyId &&
          (pricing.location_id || null) === targetLocationId &&
          ruleContext === targetPricingContext &&
          ruleEffectiveDate === targetEffectiveDate // Must match same effective date
        );
      },
    );

    // Build the request object
    const request: UpsertPricingRuleRequest = {
      id: existingPricing?.id,
      organization_id: organizationId,
      scope: "option",
      pricing_type: "fixed",
      pricing_context: targetPricingContext,
      field_config_id: fieldConfigId,
      option_value: optionValue,
      base_price: customerPrice,
      currency: options?.currency || "USD",
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      expires_at: options?.expirationDate || null,
      effective_at: targetEffectiveAt, // Use the target effective date
    };

    // Only include worker_payment fields for customer pricing rules
    // Worker pricing rules use base_price directly and cannot have worker_payment fields
    if (targetPricingContext === "customer") {
      request.worker_payment_type = options?.workerPaymentRate
        ? "fixed_rate"
        : existingPricing?.worker_payment_type || null;
      request.worker_payment_value = options?.workerPaymentRate ?? null;
    }

    const pricing = await PricingService.upsertRule(request);

    // Only refetch if not explicitly skipped (for bulk operations)
    if (!options?.skipRefetch) {
      await fetchOptionPricing();
    }
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
    filters?.pricingContext,
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

const transformOptionRule = (rule: PricingRule): OptionPricing => {
  const isWorkerContext = rule.pricing_context === "worker";
  const basePrice = rule.base_price ?? 0;

  return {
    id: rule.id,
    organization_id: rule.organization_id,
    field_config_id: rule.field_config_id || "",
    option_value: rule.option_value || "",
    customer_price: basePrice,
    // For worker context rules, worker_payment_rate comes from base_price
    // For customer context rules, it comes from worker_payment_value field
    worker_payment_rate: isWorkerContext
      ? basePrice
      : rule.worker_payment_value ?? null,
    worker_payment_type: rule.worker_payment_type ?? null,
    location_id: rule.location_id,
    location_hierarchy_id: rule.location_hierarchy_id,
    currency: rule.currency,
    source_rule: rule,
    field_config: rule.field_config,
    location: rule.location,
    location_node: rule.location_node,
  };
};
