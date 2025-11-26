"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import WorkerForm from "@/components/workers/worker-form";
import WorkerList from "@/components/workers/worker-list";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function WorkersPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { workers, loading, error, createWorker, updateWorker, deleteWorker } =
    useWorkers();
  const [isWorkerFormOpen, setIsWorkerFormOpen] = useState(false);

  const handleAddWorker = async (workerData: {
    name: string;
    email: string;
    phone: string;
  }) => {
    if (!organizationId) return;
    await createWorker({
      organization_id: organizationId,
      ...workerData,
    });
  };

  const handleUpdateWorker = async (
    workerId: string,
    workerData: {
      name: string;
      email: string;
      phone: string;
      active?: boolean;
    }
  ) => {
    await updateWorker({
      id: workerId,
      ...workerData,
    });
  };

  const handleDeleteWorker = async (workerId: string) => {
    await deleteWorker({ id: workerId });
  };

  if (orgLoading) {
    return <LoadingState message="Loading workers..." fullScreen />;
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
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
          workers={workers}
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
