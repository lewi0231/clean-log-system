"use client";

import { BasePricingService } from "@/lib/services";
import type { BasePricing } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

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
    location_id?: string | null;
    currency?: string;
  }) => Promise<BasePricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useBasePricing(
  locationId?: string | null
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

      const pricing = await BasePricingService.list({
        organization_id: organizationId,
        location_id: locationId,
      });

      setBasePricing(pricing);
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
    location_id?: string | null;
    currency?: string;
  }): Promise<BasePricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const pricing = await BasePricingService.upsert({
      organization_id: organizationId,
      ...request,
      currency: request.currency || "USD",
    });

    await fetchBasePricing();
    return pricing;
  };

  const deletePricing = async (id: string): Promise<void> => {
    await BasePricingService.delete({ id });
    await fetchBasePricing();
  };

  useEffect(() => {
    fetchBasePricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, locationId]);

  return {
    basePricing,
    loading,
    error,
    refetch: fetchBasePricing,
    upsertPricing,
    deletePricing,
  };
}
