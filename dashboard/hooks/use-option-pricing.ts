"use client";

import { OptionPricingService } from "@/lib/services";
import type { OptionPricing } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

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
      currency?: string;
    }
  ) => Promise<OptionPricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useOptionPricing(
  fieldConfigId?: string,
  locationId?: string | null
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

      const pricing = await OptionPricingService.list({
        organization_id: organizationId,
        field_config_id: fieldConfigId,
        location_id: locationId,
      });

      setOptionPricing(pricing);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch option pricing"
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
      currency?: string;
    }
  ): Promise<OptionPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const pricing = await OptionPricingService.upsert({
      organization_id: organizationId,
      field_config_id: fieldConfigId,
      option_value: optionValue,
      customer_price: customerPrice,
      worker_payment_rate: options?.workerPaymentRate,
      location_id: options?.locationId,
      currency: options?.currency || "USD",
    });

    await fetchOptionPricing();
    return pricing;
  };

  const deletePricing = async (id: string): Promise<void> => {
    await OptionPricingService.delete({ id });
    await fetchOptionPricing();
  };

  useEffect(() => {
    fetchOptionPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, fieldConfigId, locationId]);

  return {
    optionPricing,
    loading,
    error,
    refetch: fetchOptionPricing,
    upsertPricing,
    deletePricing,
  };
}
