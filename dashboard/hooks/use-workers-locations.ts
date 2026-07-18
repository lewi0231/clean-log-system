"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { workersLocationsKey } from "@/app/query-provider";
import { WorkersService } from "@/lib/services";
import type { ListWorkersAndLocationsResponse } from "@/lib/types/api";
import useOrganization from "./useOrganization";

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

  // Realtime: `RealtimeSubscriptions` in the dashboard layout mounts `useRealtimeWorkers`
  // once for the whole app — do not subscribe again here (duplicate channels / missed refetches).
  // `refetchOnWindowFocus` and `refetchOnReconnect` handle browser-level refresh when Realtime drops.

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
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
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
