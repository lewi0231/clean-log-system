"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { locationHierarchyKey, workersLocationsKey } from "@/app/query-provider";
import { LocationsService } from "@/lib/services";
import type { Location } from "@/lib/types";
import type {
  CreateLocationRequest,
  DeleteLocationRequest,
  UpdateLocationRequest,
} from "@/lib/types/api";
import { log } from "@/lib/logger";
import { useCallback } from "react";
import { useWorkersAndLocations } from "./use-workers-locations";
import useOrganization from "./useOrganization";

type WorkersLocationsCache = { workers: unknown[]; locations: Location[] };

interface UseLocationsResult {
  locations: Location[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createLocation: (request: CreateLocationRequest) => Promise<Location>;
  updateLocation: (request: UpdateLocationRequest) => Promise<Location>;
  deleteLocation: (request: DeleteLocationRequest) => Promise<void>;
}

/**
 * Hook for managing locations with React Query's native optimistic updates.
 *
 * Uses the same pattern as section mutations and pricing hooks:
 * - onMutate: Cancel queries, snapshot cache, optimistically update
 * - onError: Rollback to snapshot
 * - onSettled: Invalidate queries to refetch and sync with server
 */
export function useLocations(): UseLocationsResult {
  const { organizationId } = useOrganization();
  const { locations, loading, error, refetch, invalidateCache } =
    useWorkersAndLocations();
  const queryClient = useQueryClient();

  const getQueryKey = useCallback(
    () => (organizationId ? workersLocationsKey(organizationId) : null),
    [organizationId],
  );

  const createMutation = useMutation({
    mutationFn: (request: CreateLocationRequest) =>
      LocationsService.create(request),
    onMutate: async (request) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      await queryClient.cancelQueries({ queryKey });
      const previousData =
        queryClient.getQueryData<WorkersLocationsCache>(queryKey);

      const tempId = `temp-location-${Date.now()}`;
      const optimisticLocation: Location = {
        id: tempId,
        name: request.name,
        email: request.email,
        address: request.address ?? null,
        contact_person: request.contact_person ?? null,
        phone: request.phone ?? null,
        active: true,
        created_at: new Date().toISOString(),
        hierarchy_parent_id: request.hierarchy_parent_id ?? null,
        pricing_mode: request.pricing_mode ?? "field_based",
        fixed_customer_price: request.fixed_customer_price ?? null,
        fixed_worker_payment: request.fixed_worker_payment ?? null,
        fixed_price_currency: request.fixed_price_currency ?? null,
      };

      queryClient.setQueryData<WorkersLocationsCache>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          locations: [...old.locations, optimisticLocation],
        };
      });

      return { previousData };
    },
    onError: (err, _request, context) => {
      log.error("Locations: Failed to create", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      invalidateCache();
    },
    onSettled: () => {
      const queryKey = getQueryKey();
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: locationHierarchyKey(organizationId),
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (request: UpdateLocationRequest) =>
      LocationsService.update(request),
    onMutate: async (request) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      await queryClient.cancelQueries({ queryKey });
      const previousData =
        queryClient.getQueryData<WorkersLocationsCache>(queryKey);

      const updates = {
        ...(request.name !== undefined && { name: request.name }),
        ...(request.email !== undefined && { email: request.email }),
        ...(request.address !== undefined && { address: request.address }),
        ...(request.contact_person !== undefined && {
          contact_person: request.contact_person,
        }),
        ...(request.phone !== undefined && { phone: request.phone }),
        ...(request.hierarchy_parent_id !== undefined && {
          hierarchy_parent_id: request.hierarchy_parent_id,
        }),
        ...(request.active !== undefined && { active: request.active }),
        ...(request.pricing_mode !== undefined && {
          pricing_mode: request.pricing_mode,
        }),
        ...(request.fixed_customer_price !== undefined && {
          fixed_customer_price: request.fixed_customer_price,
        }),
        ...(request.fixed_worker_payment !== undefined && {
          fixed_worker_payment: request.fixed_worker_payment,
        }),
        ...(request.fixed_price_currency !== undefined && {
          fixed_price_currency: request.fixed_price_currency,
        }),
      };

      queryClient.setQueryData<WorkersLocationsCache>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          locations: old.locations.map((loc) =>
            loc.id === request.id
              ? { ...loc, ...updates }
              : loc,
          ),
        };
      });

      return { previousData };
    },
    onError: (err, _request, context) => {
      log.error("Locations: Failed to update", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      invalidateCache();
    },
    onSettled: () => {
      const queryKey = getQueryKey();
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: locationHierarchyKey(organizationId),
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (request: DeleteLocationRequest) =>
      LocationsService.delete(request),
    onMutate: async (request) => {
      const queryKey = getQueryKey();
      if (!queryKey) return;

      await queryClient.cancelQueries({ queryKey });
      const previousData =
        queryClient.getQueryData<WorkersLocationsCache>(queryKey);

      queryClient.setQueryData<WorkersLocationsCache>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          locations: old.locations.filter((loc) => loc.id !== request.id),
        };
      });

      return { previousData };
    },
    onError: (err, _request, context) => {
      log.error("Locations: Failed to delete", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      const queryKey = getQueryKey();
      if (queryKey && context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      invalidateCache();
    },
    onSettled: () => {
      const queryKey = getQueryKey();
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: locationHierarchyKey(organizationId),
        });
      }
    },
  });

  const createLocation = useCallback(
    async (request: CreateLocationRequest): Promise<Location> => {
      return createMutation.mutateAsync(request);
    },
    [createMutation],
  );

  const updateLocation = useCallback(
    async (request: UpdateLocationRequest): Promise<Location> => {
      return updateMutation.mutateAsync(request);
    },
    [updateMutation],
  );

  const deleteLocation = useCallback(
    async (request: DeleteLocationRequest): Promise<void> => {
      await deleteMutation.mutateAsync(request);
    },
    [deleteMutation],
  );

  return {
    locations,
    loading,
    error,
    refetch: useCallback(() => refetch().then(() => undefined), [refetch]),
    createLocation,
    updateLocation,
    deleteLocation,
  };
}
