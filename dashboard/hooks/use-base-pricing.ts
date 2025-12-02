"use client";

import { PricingService } from "@/lib/services";
import type { BasePricing, PricingRule } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseBasePricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
}

interface UseBasePricingResult {
  basePricing: BasePricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (request: {
    job_type_field_config_id?: string | null;
    job_type_value?: string | null;
    standalone_base_price?: number | null;
    customer_base_price: number;
    worker_base_payment?: number | null;
    adjustment_type?: "add" | "multiply";
    location_id?: string | null;
    currency?: string;
  }) => Promise<BasePricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useBasePricing(
  filters?: UseBasePricingOptions
): UseBasePricingResult {
  const { organizationId } = useOrganization();
  const [basePricing, setBasePricing] = useState<BasePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBasePricing = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["base"],
        location_hierarchy_id: filters?.locationHierarchyId ?? null,
        location_id: filters?.locationId ?? null,
        effective_at: filters?.effectiveAt ?? undefined,
      });

      setBasePricing(pricing.map(transformBaseRule));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch base pricing"
      );
      setBasePricing([]);
    } finally {
      setLoading(false);
    }
  };

  const upsertPricing = async (request: {
    job_type_field_config_id?: string | null;
    job_type_value?: string | null;
    standalone_base_price?: number | null;
    customer_base_price: number;
    worker_base_payment?: number | null;
    adjustment_type?: "add" | "multiply";
    location_id?: string | null;
    currency?: string;
  }): Promise<BasePricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = filters?.locationHierarchyId ?? null;
    const targetLocationId = filters?.locationId ?? null;

    const isFieldBased = Boolean(request.job_type_field_config_id);

    const existing = basePricing.find((pricing) => {
      const matchesLocation =
        (pricing.location_hierarchy_id || null) === targetLocationHierarchyId &&
        (pricing.location_id || null) === targetLocationId;

      if (!matchesLocation) return false;

      if (isFieldBased) {
        return (
          pricing.job_type_field_config_id ===
            request.job_type_field_config_id &&
          pricing.job_type_value === request.job_type_value
        );
      }

      return !pricing.job_type_field_config_id;
    });

    const adjustmentType = request.adjustment_type || "add";
    const pricingType = adjustmentType === "add" ? "fixed" : "percentage";

    const pricing = await PricingService.upsertRule({
      id: existing?.id,
      organization_id: organizationId,
      scope: "base",
      pricing_type: pricingType,
      field_config_id: request.job_type_field_config_id || null,
      option_value: request.job_type_value || null,
      base_price: adjustmentType === "add" ? request.customer_base_price : null,
      percentage_rate:
        adjustmentType === "multiply" ? request.customer_base_price : null,
      metadata: {
        adjustment_type: adjustmentType,
      },
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: request.location_id ?? targetLocationId,
      worker_payment_type: request.worker_base_payment
        ? "fixed_rate"
        : existing?.worker_payment_type || null,
      worker_payment_value: request.worker_base_payment ?? null,
      currency: request.currency || "USD",
    });

    await fetchBasePricing();
    return transformBaseRule(pricing);
  };

  const deletePricing = async (id: string): Promise<void> => {
    await PricingService.deleteRule(id);
    await fetchBasePricing();
  };

  useEffect(() => {
    fetchBasePricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    organizationId,
    filters?.locationHierarchyId,
    filters?.locationId,
    filters?.effectiveAt,
  ]);

  return {
    basePricing,
    loading,
    error,
    refetch: fetchBasePricing,
    upsertPricing,
    deletePricing,
  };
}

const transformBaseRule = (rule: PricingRule): BasePricing => {
  const adjustmentType =
    (typeof (rule.metadata as Record<string, unknown> | undefined)?.[
      "adjustment_type"
    ] === "string"
      ? ((rule.metadata as Record<string, unknown>)["adjustment_type"] as
          | "add"
          | "multiply")
      : undefined) || (rule.pricing_type === "percentage" ? "multiply" : "add");

  const customerValue =
    adjustmentType === "multiply"
      ? rule.percentage_rate ?? 0
      : rule.base_price ?? 0;

  return {
    id: rule.id,
    organization_id: rule.organization_id,
    job_type_field_config_id: rule.field_config_id || null,
    job_type_value: rule.option_value || null,
    adjustment_type: adjustmentType,
    customer_base_price: customerValue,
    worker_base_payment: rule.worker_payment_value ?? null,
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
