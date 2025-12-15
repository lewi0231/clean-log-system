"use client";

import { PricingService } from "@/lib/services";
import type { PricingHistoryEntry } from "@/lib/services/pricing.service";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

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
  options?: UsePricingHistoryOptions,
): UsePricingHistoryResult {
  const { organizationId } = useOrganization();
  const [historyEntries, setHistoryEntries] = useState<PricingHistoryEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const history = await PricingService.listHistory(organizationId, {
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
        pricingContext: options?.pricingContext,
      });

      setHistoryEntries(history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch pricing history",
      );
      setHistoryEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    organizationId,
    options?.dateFrom,
    options?.dateTo,
    options?.pricingContext,
    options?.refreshToken,
  ]);

  return {
    historyEntries,
    loading,
    error,
    refetch: fetchHistory,
  };
}
