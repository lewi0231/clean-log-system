"use client";

import LocationForm from "@/components/locations/location-form";
import LocationList from "@/components/locations/location-list";
import { Button } from "@/components/ui/button";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { Location } from "@/lib/types";
import { Plus } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";

type OptimisticAction<T> =
  | { type: "add"; item: T }
  | { type: "update"; item: T }
  | { type: "delete"; id: string };

function locationsReducer(
  state: Location[],
  action: OptimisticAction<Location>
): Location[] {
  switch (action.type) {
    case "add":
      return [action.item, ...state];
    case "update":
      return state.map((l) => (l.id === action.item.id ? action.item : l));
    case "delete":
      return state.filter((l) => l.id !== action.id);
    default:
      return state;
  }
}

export default function LocationsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Optimistic state for locations
  const [optimisticLocations, updateOptimisticLocations] = useOptimistic(
    locations,
    locationsReducer
  );

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      log.debug("LocationsPage: Fetching locations");

      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-workers-and-locations",
        {
          body: { organization_id: organizationId },
        }
      );

      if (fetchError) {
        throw fetchError;
      }

      if (data?.locations) {
        log.info("LocationsPage: Locations fetched successfully", {
          locationsCount: data.locations.length,
        });
        setLocations(data.locations);
      } else {
        setLocations([]);
      }
    } catch (err) {
      log.error("LocationsPage: Failed to fetch locations", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(
        err instanceof Error ? err.message : "Failed to fetch locations"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (locationData: {
    name: string;
    email: string;
    address: string;
    contact_person: string;
    phone?: string;
  }) => {
    // Optimistically add location
    const optimisticLocation: Location = {
      id: `temp-${Date.now()}`,
      ...locationData,
      phone: locationData.phone || null,
      active: true,
      created_at: new Date().toISOString(),
    };

    startTransition(() => {
      updateOptimisticLocations({ type: "add", item: optimisticLocation });
    });

    try {
      const { error: createError } = await supabase.functions.invoke(
        "create-location",
        {
          body: {
            ...locationData,
            organization_id: organizationId,
          },
        }
      );

      if (createError) {
        throw createError;
      }

      await fetchLocations();
      log.info("LocationsPage: Location created successfully");
    } catch (err) {
      log.error("LocationsPage: Failed to create location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchLocations();
      throw err;
    }
  };

  const handleUpdateLocation = async (
    locationId: string,
    locationData: {
      name: string;
      email: string;
      address: string;
      contact_person: string;
      phone?: string;
    }
  ) => {
    const existingLocation = locations.find((l) => l.id === locationId);
    if (!existingLocation) return;

    // Optimistically update location
    const optimisticLocation: Location = {
      ...existingLocation,
      ...locationData,
    };

    startTransition(() => {
      updateOptimisticLocations({ type: "update", item: optimisticLocation });
    });

    try {
      const { error: updateError } = await supabase.functions.invoke(
        "update-location",
        {
          body: {
            id: locationId,
            ...locationData,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      await fetchLocations();
      log.info("LocationsPage: Location updated successfully");
    } catch (err) {
      log.error("LocationsPage: Failed to update location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchLocations();
      throw err;
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    // Optimistically delete location
    startTransition(() => {
      updateOptimisticLocations({ type: "delete", id: locationId });
    });

    try {
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-location",
        {
          body: { id: locationId },
        }
      );

      if (deleteError) {
        throw deleteError;
      }

      await fetchLocations();
      log.info("LocationsPage: Location deleted successfully");
    } catch (err) {
      log.error("LocationsPage: Failed to delete location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchLocations();
      throw err;
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading locations...</p>
        </div>
      </div>
    );
  }

  if (orgError || !organizationId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">
            {orgError || "Failed to load organization"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization&apos;s locations
        </p>
      </div>

      <div className="mb-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          These locations will appear as select options in the mobile app when
          the &quot;Use Predefined Locations&quot; setting is enabled. You can
          also configure custom location fields in{" "}
          <a
            href="/dashboard/mobile-config"
            className="text-primary hover:underline font-medium"
          >
            Mobile Config
          </a>
          .
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" />
        <Button onClick={() => setIsLocationFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      <div className="space-y-4">
        <LocationList
          locations={optimisticLocations}
          loading={loading}
          error={error}
          onDeleteLocation={handleDeleteLocation}
          onUpdateLocation={handleUpdateLocation}
        />
      </div>

      <LocationForm
        open={isLocationFormOpen}
        onOpenChange={setIsLocationFormOpen}
        onSuccess={async (locationData, locationId) => {
          setIsLocationFormOpen(false);
          if (locationId) {
            await handleUpdateLocation(locationId, locationData);
          } else {
            await handleAddLocation(locationData);
          }
        }}
      />
    </>
  );
}
