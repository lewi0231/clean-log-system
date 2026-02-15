"use client";

import { useQuery } from "@tanstack/react-query";

import { pricingHistoryKey } from "@/app/query-provider";
import { PricingService } from "@/lib/services";
import type { PricingHistoryEntry } from "@/lib/services/pricing.service";

interface UsePricingHistoryOptions {
  dateFrom?: string;
  dateTo?: string;
  pricingContext?: "customer" | "worker";
  refreshToken?: string | number; // Token to trigger refetch when pricing changes
}

interface UsePricingHistoryResult {
  historyEntries: PricingHistoryEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePricingHistory(
  organizationId: string | null,
  options?: UsePricingHistoryOptions,
): UsePricingHistoryResult {
  const queryKey = pricingHistoryKey(organizationId, {
    dateFrom: options?.dateFrom,
    dateTo: options?.dateTo,
    pricingContext: options?.pricingContext,
    refreshToken: options?.refreshToken,
  });

  const {
    data,
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      return PricingService.listHistory(organizationId, {
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
        pricingContext: options?.pricingContext,
      });
    },
    enabled: !!organizationId,
  });

  const refetch = async () => {
    await queryRefetch();
  };

  return {
    historyEntries: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch pricing history") : null,
    refetch,
  };
}
