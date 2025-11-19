"use client";

import LocationForm from "@/components/locations/location-form";
import LocationList from "@/components/locations/location-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WorkerForm from "@/components/workers/worker-form";
import WorkerList from "@/components/workers/worker-list";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { Location, Worker } from "@/lib/types";
import { Plus } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";

type OptimisticAction<T> =
  | { type: "add"; item: T }
  | { type: "update"; item: T }
  | { type: "delete"; id: string };

function workersReducer(
  state: Worker[],
  action: OptimisticAction<Worker>
): Worker[] {
  switch (action.type) {
    case "add":
      return [action.item, ...state];
    case "update":
      return state.map((w) => (w.id === action.item.id ? action.item : w));
    case "delete":
      return state.filter((w) => w.id !== action.id);
    default:
      return state;
  }
}

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

export default function Dashboard() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const [activeTab, setActiveTab] = useState("workers");
  const [isWorkerFormOpen, setIsWorkerFormOpen] = useState(false);
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Optimistic state for workers and locations
  const [optimisticWorkers, updateOptimisticWorkers] = useOptimistic(
    workers,
    workersReducer
  );
  const [optimisticLocations, updateOptimisticLocations] = useOptimistic(
    locations,
    locationsReducer
  );

  const fetchWorkersAndLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      log.debug("Dashboard: Fetching workers and locations");

      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-workers-and-locations",
        {
          body: { organization_id: organizationId },
        }
      );

      if (fetchError) {
        throw fetchError;
      }

      if (data?.workers && data?.locations) {
        log.info("Dashboard: Workers and locations fetched successfully", {
          workersCount: data.workers.length,
          locationsCount: data.locations.length,
        });
        setWorkers(data.workers);
        setLocations(data.locations);
      } else {
        setWorkers([]);
        setLocations([]);
      }
    } catch (err) {
      log.error("Dashboard: Failed to fetch workers and locations", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch workers and locations"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (workerData: {
    name: string;
    email: string;
    phone: string;
  }) => {
    // Optimistically add worker
    const optimisticWorker: Worker = {
      id: `temp-${Date.now()}`,
      ...workerData,
      pin_code: "0000", // Will be updated from server
      active: true,
      created_at: new Date().toISOString(),
    };

    startTransition(() => {
      updateOptimisticWorkers({ type: "add", item: optimisticWorker });
    });

    try {
      const { error: createError } = await supabase.functions.invoke(
        "create-worker",
        {
          body: {
            ...workerData,
            organization_id: organizationId,
          },
        }
      );

      if (createError) {
        throw createError;
      }

      // Refetch to get the real data (with pin_code from server)
      await fetchWorkersAndLocations();
      log.info("Dashboard: Worker created successfully");
    } catch (err) {
      log.error("Dashboard: Failed to create worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      // Refetch to revert optimistic update
      await fetchWorkersAndLocations();
      throw err;
    }
  };

  const handleUpdateWorker = async (
    workerId: string,
    workerData: { name: string; email: string; phone: string }
  ) => {
    const existingWorker = workers.find((w) => w.id === workerId);
    if (!existingWorker) return;

    // Optimistically update worker
    const optimisticWorker: Worker = {
      ...existingWorker,
      ...workerData,
    };

    startTransition(() => {
      updateOptimisticWorkers({ type: "update", item: optimisticWorker });
    });

    try {
      const { error: updateError } = await supabase.functions.invoke(
        "update-worker",
        {
          body: {
            id: workerId,
            ...workerData,
          },
        }
      );

      if (updateError) {
        throw updateError;
      }

      await fetchWorkersAndLocations();
      log.info("Dashboard: Worker updated successfully");
    } catch (err) {
      log.error("Dashboard: Failed to update worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkersAndLocations();
      throw err;
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    // Optimistically delete worker
    startTransition(() => {
      updateOptimisticWorkers({ type: "delete", id: workerId });
    });

    try {
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-worker",
        {
          body: { id: workerId },
        }
      );

      if (deleteError) {
        throw deleteError;
      }

      await fetchWorkersAndLocations();
      log.info("Dashboard: Worker deleted successfully");
    } catch (err) {
      log.error("Dashboard: Failed to delete worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkersAndLocations();
      throw err;
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

      await fetchWorkersAndLocations();
      log.info("Dashboard: Location created successfully");
    } catch (err) {
      log.error("Dashboard: Failed to create location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkersAndLocations();
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

      await fetchWorkersAndLocations();
      log.info("Dashboard: Location updated successfully");
    } catch (err) {
      log.error("Dashboard: Failed to update location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkersAndLocations();
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

      await fetchWorkersAndLocations();
      log.info("Dashboard: Location deleted successfully");
    } catch (err) {
      log.error("Dashboard: Failed to delete location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkersAndLocations();
      throw err;
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchWorkersAndLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
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
    <div className="min-h-screen bg-background pt-32">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your workers and locations
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="workers">Workers</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
            </TabsList>
            {activeTab === "workers" ? (
              <Button
                className="cursor-pointer"
                onClick={() => setIsWorkerFormOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Worker
              </Button>
            ) : (
              <Button onClick={() => setIsLocationFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            )}
          </div>

          <TabsContent value="workers" className="space-y-4">
            <WorkerList
              workers={optimisticWorkers}
              loading={loading}
              error={error}
              onDeleteWorker={handleDeleteWorker}
              onUpdateWorker={handleUpdateWorker}
            />
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <LocationList
              locations={optimisticLocations}
              loading={loading}
              error={error}
              onDeleteLocation={handleDeleteLocation}
              onUpdateLocation={handleUpdateLocation}
            />
          </TabsContent>
        </Tabs>

        <WorkerForm
          open={isWorkerFormOpen}
          onOpenChange={setIsWorkerFormOpen}
          onSuccess={async (workerData, workerId) => {
            setIsWorkerFormOpen(false);
            if (workerId) {
              await handleUpdateWorker(workerId, workerData);
            } else {
              await handleAddWorker(workerData);
            }
          }}
        />

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
      </div>
    </div>
  );
}
