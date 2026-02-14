"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { workersLocationsKey } from "@/app/query-provider";
import { WorkersService } from "@/lib/services";
import type { ListWorkersAndLocationsResponse } from "@/lib/types/api";
import useOrganization from "./useOrganization";
import { useRealtimeWorkers } from "./use-realtime-workers";

async function fetchWorkersAndLocations(
  organizationId: string
): Promise<ListWorkersAndLocationsResponse> {
  return WorkersService.listWorkersAndLocations({
    organization_id: organizationId,
  });
}

export function useWorkersAndLocations() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  // Subscribe to real-time worker changes (auto-invalidates cache)
  useRealtimeWorkers(organizationId);

  const query = useQuery({
    queryKey: workersLocationsKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchWorkersAndLocations(organizationId as string),
    select: (data) => ({
      workers: data?.workers ?? [],
      locations: data?.locations ?? [],
    }),
    // Keep previous data to avoid loading flicker on org switches
    placeholderData: (previous) => previous,
  });

  const invalidateCache = () => {
    void queryClient.invalidateQueries({
      queryKey: workersLocationsKey(organizationId),
    });
  };

  return {
    workers: query.data?.workers ?? [],
    locations: query.data?.locations ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch().then(() => undefined),
    invalidateCache,
  };
}
