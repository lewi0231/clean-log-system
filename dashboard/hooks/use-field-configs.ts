"use client";

import { fieldConfigsKey } from "@/app/query-provider";
import { FieldConfigsService } from "@/lib/services";
import type { FieldConfig } from "@clean-log/shared/types";
import { useQuery } from "@tanstack/react-query";
import useOrganization from "./useOrganization";

interface UseFieldConfigsResult {
  fieldConfigs: FieldConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseFieldConfigsOptions {
  locationId?: string | null;
}

export function useFieldConfigs(options?: UseFieldConfigsOptions): UseFieldConfigsResult {
  const { organizationId } = useOrganization();
  const locationId = options?.locationId ?? null;

  const query = useQuery({
    queryKey: fieldConfigsKey(organizationId, locationId),
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) {
        return [] as FieldConfig[];
      }
      return FieldConfigsService.list({
        organization_id: organizationId,
        location_id: locationId || undefined,
      });
    },
    staleTime: 5 * 60 * 1000,
    // Keep last result visible while refetching (avoids empty flash on revisit)
    placeholderData: (previous) => previous,
  });

  return {
    fieldConfigs: query.data ?? [],
    // isLoading = pending + fetching. Disabled queries (no org) are pending+idle → not loading.
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: async () => {
      await query.refetch();
    },
  };
}
