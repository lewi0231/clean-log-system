"use client";

import { PricingService } from "@/lib/services";
import type {
  FieldPricing,
  PricingRule,
  PricingType,
  WorkerPaymentType,
} from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseFieldPricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
}

interface UseFieldPricingResult {
  fieldPricing: FieldPricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (
    fieldConfigId: string,
    customerPrice: number,
    options?: {
      currency?: string;
      locationId?: string | null;
      locationHierarchyId?: string | null;
      pricingType?: PricingType;
      appliesToFieldType?: string;
      workerPaymentType?: WorkerPaymentType | null;
      workerPaymentValue?: number | null;
    }
  ) => Promise<FieldPricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useFieldPricing(
  options?: UseFieldPricingOptions
): UseFieldPricingResult {
  const { organizationId } = useOrganization();
  const [fieldPricing, setFieldPricing] = useState<FieldPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFieldPricing = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["field"],
        location_hierarchy_id: options?.locationHierarchyId ?? null,
        location_id: options?.locationId ?? null,
        effective_at: options?.effectiveAt ?? undefined,
      });

      setFieldPricing(pricing.map(transformFieldPricing));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch field pricing"
      );
      setFieldPricing([]);
    } finally {
      setLoading(false);
    }
  };

  const upsertPricing = async (
    fieldConfigId: string,
    customerPrice: number,
    options?: {
      currency?: string;
      locationId?: string | null;
      locationHierarchyId?: string | null;
      pricingType?: PricingType;
      appliesToFieldType?: string;
      workerPaymentType?: WorkerPaymentType | null;
      workerPaymentValue?: number | null;
    }
  ): Promise<FieldPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = options?.locationHierarchyId ?? null;
    const targetLocationId = options?.locationId ?? null;

    const existingRule = fieldPricing.find(
      (rule) =>
        rule.field_config_id === fieldConfigId &&
        (rule.location_hierarchy_id || null) === targetLocationHierarchyId &&
        (rule.location_id || null) === targetLocationId
    );

    const pricing = await PricingService.upsertRule({
      id: existingRule?.id,
      organization_id: organizationId,
      scope: "field",
      pricing_type: options?.pricingType || "unit",
      field_config_id: fieldConfigId,
      applies_to_field_type: options?.appliesToFieldType,
      base_price: customerPrice,
      currency: options?.currency || "USD",
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      worker_payment_type: options?.workerPaymentType || null,
      worker_payment_value: options?.workerPaymentValue ?? null,
    });

    await fetchFieldPricing();
    return transformFieldPricing(pricing);
  };

  const deletePricing = async (id: string): Promise<void> => {
    await PricingService.deleteRule(id);
    await fetchFieldPricing();
  };

  useEffect(() => {
    fetchFieldPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    organizationId,
    options?.locationHierarchyId,
    options?.locationId,
    options?.effectiveAt,
  ]);

  return {
    fieldPricing,
    loading,
    error,
    refetch: fetchFieldPricing,
    upsertPricing,
    deletePricing,
  };
}

const transformFieldPricing = (rule: PricingRule): FieldPricing => ({
  id: rule.id,
  organization_id: rule.organization_id,
  field_config_id: rule.field_config_id || "",
  location_id: rule.location_id,
  location_hierarchy_id: rule.location_hierarchy_id,
  pricing_type: rule.pricing_type,
  customer_price:
    rule.pricing_type === "percentage"
      ? rule.percentage_rate ?? 0
      : rule.base_price ?? 0,
  currency: rule.currency,
  applies_to_field_type: rule.applies_to_field_type || null,
  worker_payment_type: rule.worker_payment_type,
  worker_payment_value: rule.worker_payment_value,
  source_rule: rule,
  field_config: rule.field_config,
  location: rule.location,
  location_node: rule.location_node,
});
