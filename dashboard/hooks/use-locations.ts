"use client";

import { LocationsService } from "@/lib/services";
import type { Location } from "@/lib/types";
import type {
  CreateLocationRequest,
  DeleteLocationRequest,
  UpdateLocationRequest,
} from "@/lib/types/api";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

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
  const { organizationId } = useOrganization();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await LocationsService.listWorkersAndLocations({
        organization_id: organizationId,
      });

      setLocations(response.locations || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch locations"
      );
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const createLocation = async (
    request: CreateLocationRequest
  ): Promise<Location> => {
    const location = await LocationsService.create(request);
    await fetchLocations();
    return location;
  };

  const updateLocation = async (
    request: UpdateLocationRequest
  ): Promise<Location> => {
    const location = await LocationsService.update(request);
    await fetchLocations();
    return location;
  };

  const deleteLocation = async (
    request: DeleteLocationRequest
  ): Promise<void> => {
    await LocationsService.delete(request);
    await fetchLocations();
  };

  useEffect(() => {
    fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
  };
}
