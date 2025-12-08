"use client";

import { WorkersService } from "@/lib/services";
import type { Worker } from "@/lib/types";
import type {
  CreateWorkerRequest,
  DeleteWorkerRequest,
  UpdateWorkerRequest,
} from "@/lib/types/api";
import { useCallback } from "react";
import { useWorkersAndLocations } from "./use-workers-locations";

interface UseWorkersResult {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createWorker: (request: CreateWorkerRequest) => Promise<Worker>;
  updateWorker: (request: UpdateWorkerRequest) => Promise<Worker>;
  deleteWorker: (request: DeleteWorkerRequest) => Promise<void>;
  resendInvitation: (workerId: string, organizationId: string) => Promise<void>;
}

export function useWorkers(): UseWorkersResult {
  const { workers, loading, error, refetch, invalidateCache } =
    useWorkersAndLocations();

  const createWorker = async (
    request: CreateWorkerRequest,
  ): Promise<Worker> => {
    const worker = await WorkersService.create(request);
    invalidateCache();
    await refetch();
    return worker;
  };

  const updateWorker = async (
    request: UpdateWorkerRequest,
  ): Promise<Worker> => {
    const worker = await WorkersService.update(request);
    invalidateCache();
    await refetch();
    return worker;
  };

  const deleteWorker = async (request: DeleteWorkerRequest): Promise<void> => {
    await WorkersService.delete(request);
    invalidateCache();
    await refetch();
  };

  const resendInvitation = async (
    workerId: string,
    orgId: string,
  ): Promise<void> => {
    if (!orgId) {
      throw new Error("Organization ID is required");
    }
    await WorkersService.resendInvitation({
      worker_id: workerId,
      organization_id: orgId,
    });
    // Don't refetch workers as nothing changes in the list
  };

  return {
    workers,
    loading,
    error,
    refetch: useCallback(() => refetch(), [refetch]),
    createWorker,
    updateWorker,
    deleteWorker,
    resendInvitation,
  };
}
