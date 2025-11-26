"use client";

import { FieldPricingService } from "@/lib/services";
import type { FieldPricing } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseFieldPricingResult {
  fieldPricing: FieldPricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (
    fieldConfigId: string,
    unitPrice: number,
    currency?: string
  ) => Promise<FieldPricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useFieldPricing(): UseFieldPricingResult {
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

      const pricing = await FieldPricingService.list({
        organization_id: organizationId,
      });

      setFieldPricing(pricing);
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
    unitPrice: number,
    currency = "USD"
  ): Promise<FieldPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const pricing = await FieldPricingService.upsert({
      organization_id: organizationId,
      field_config_id: fieldConfigId,
      unit_price: unitPrice,
      currency,
    });

    await fetchFieldPricing();
    return pricing;
  };

  const deletePricing = async (id: string): Promise<void> => {
    await FieldPricingService.delete({ id });
    await fetchFieldPricing();
  };

  useEffect(() => {
    fetchFieldPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    fieldPricing,
    loading,
    error,
    refetch: fetchFieldPricing,
    upsertPricing,
    deletePricing,
  };
}
