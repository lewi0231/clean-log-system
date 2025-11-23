"use client";

import { Button } from "@/components/ui/button";
import WorkerForm from "@/components/workers/worker-form";
import WorkerList from "@/components/workers/worker-list";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { Worker } from "@/lib/types";
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

export default function WorkersPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const [isWorkerFormOpen, setIsWorkerFormOpen] = useState(false);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Optimistic state for workers
  const [optimisticWorkers, updateOptimisticWorkers] = useOptimistic(
    workers,
    workersReducer
  );

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError(null);
      log.debug("WorkersPage: Fetching workers");

      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-workers-and-locations",
        {
          body: { organization_id: organizationId },
        }
      );

      if (fetchError) {
        throw fetchError;
      }

      if (data?.workers) {
        log.info("WorkersPage: Workers fetched successfully", {
          workersCount: data.workers.length,
        });
        setWorkers(data.workers);
      } else {
        setWorkers([]);
      }
    } catch (err) {
      log.error("WorkersPage: Failed to fetch workers", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(err instanceof Error ? err.message : "Failed to fetch workers");
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (workerData: {
    name: string;
    email: string;
    phone: string;
  }) => {
    // Optimistically add worker (inactive until they accept invite)
    const optimisticWorker: Worker = {
      id: `temp-${Date.now()}`,
      ...workerData,
      auth_user_id: null,
      active: false,
      created_at: new Date().toISOString(),
    };

    // TODO - work out why not optimistically updating.
    startTransition(() => {
      updateOptimisticWorkers({ type: "add", item: optimisticWorker });
    });

    try {
      const { data, error: createError } = await supabase.functions.invoke(
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

      await fetchWorkers();

      log.info("WorkersPage: Worker created successfully");
    } catch (err) {
      log.error("WorkersPage: Failed to create worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      // Refetch to revert optimistic update
      await fetchWorkers();
      throw err;
    }
  };

  const handleUpdateWorker = async (
    workerId: string,
    workerData: { name: string; email: string; phone: string; active?: boolean }
  ) => {
    const existingWorker = workers.find((w) => w.id === workerId);
    if (!existingWorker) return;

    // Optimistically update worker
    const optimisticWorker: Worker = {
      ...existingWorker,
      ...workerData,
      active:
        workerData.active !== undefined
          ? workerData.active
          : existingWorker.active,
    };

    startTransition(() => {
      updateOptimisticWorkers({ type: "update", item: optimisticWorker });
    });

    try {
      // Build update body with only provided fields
      const updateBody: {
        id: string;
        name?: string;
        email?: string;
        phone?: string;
        active?: boolean;
      } = { id: workerId };

      if (workerData.name !== undefined) updateBody.name = workerData.name;
      if (workerData.email !== undefined) updateBody.email = workerData.email;
      if (workerData.phone !== undefined) updateBody.phone = workerData.phone;
      if (workerData.active !== undefined)
        updateBody.active = workerData.active;

      const { data, error: updateError } = await supabase.functions.invoke(
        "update-worker",
        {
          body: updateBody,
        }
      );

      if (updateError) {
        throw updateError;
      }

      await fetchWorkers();

      log.info("WorkersPage: Worker updated successfully");
    } catch (err) {
      log.error("WorkersPage: Failed to update worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkers();
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

      await fetchWorkers();
      log.info("WorkersPage: Worker deleted successfully");
    } catch (err) {
      log.error("WorkersPage: Failed to delete worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      await fetchWorkers();
      throw err;
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchWorkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading workers...</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Workers</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization&apos;s workers
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" />
        <Button
          className="cursor-pointer"
          onClick={() => setIsWorkerFormOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Worker
        </Button>
      </div>

      <div className="space-y-4">
        <WorkerList
          workers={optimisticWorkers}
          loading={loading}
          error={error}
          onDeleteWorker={handleDeleteWorker}
          onUpdateWorker={handleUpdateWorker}
        />
      </div>

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
    </>
  );
}
