"use client";

import { LocationsService } from "@/lib/services";
import type { Location } from "@/lib/types";
import type {
  CreateLocationRequest,
  DeleteLocationRequest,
  UpdateLocationRequest,
} from "@/lib/types/api";
import { useCallback } from "react";
import { useWorkersAndLocations } from "./use-workers-locations";

interface UseLocationsResult {
  locations: Location[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createLocation: (request: CreateLocationRequest) => Promise<Location>;
  updateLocation: (request: UpdateLocationRequest) => Promise<Location>;
  deleteLocation: (request: DeleteLocationRequest) => Promise<void>;
}

export function useLocations(): UseLocationsResult {
  const { locations, loading, error, refetch, invalidateCache } =
    useWorkersAndLocations();

  const createLocation = async (
    request: CreateLocationRequest,
  ): Promise<Location> => {
    const location = await LocationsService.create(request);
    invalidateCache();
    await refetch();
    return location;
  };

  const updateLocation = async (
    request: UpdateLocationRequest,
  ): Promise<Location> => {
    const location = await LocationsService.update(request);
    invalidateCache();
    await refetch();
    return location;
  };

  const deleteLocation = async (
    request: DeleteLocationRequest,
  ): Promise<void> => {
    await LocationsService.delete(request);
    invalidateCache();
    await refetch();
  };

  return {
    locations,
    loading,
    error,
    refetch: useCallback(() => refetch(), [refetch]),
    createLocation,
    updateLocation,
    deleteLocation,
  };
}
