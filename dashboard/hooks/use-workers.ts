"use client";

import { WorkersService } from "@/lib/services";
import type { Worker } from "@/lib/types";
import type {
  CreateWorkerRequest,
  DeleteWorkerRequest,
  UpdateWorkerRequest,
} from "@/lib/types/api";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseWorkersResult {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createWorker: (request: CreateWorkerRequest) => Promise<Worker>;
  updateWorker: (request: UpdateWorkerRequest) => Promise<Worker>;
  deleteWorker: (request: DeleteWorkerRequest) => Promise<void>;
}

export function useWorkers(): UseWorkersResult {
  const { organizationId } = useOrganization();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await WorkersService.listWorkersAndLocations({
        organization_id: organizationId,
      });

      setWorkers(response.workers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workers");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const createWorker = async (
    request: CreateWorkerRequest
  ): Promise<Worker> => {
    const worker = await WorkersService.create(request);
    await fetchWorkers();
    return worker;
  };

  const updateWorker = async (
    request: UpdateWorkerRequest
  ): Promise<Worker> => {
    const worker = await WorkersService.update(request);
    await fetchWorkers();
    return worker;
  };

  const deleteWorker = async (request: DeleteWorkerRequest): Promise<void> => {
    await WorkersService.delete(request);
    await fetchWorkers();
  };

  useEffect(() => {
    fetchWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    workers,
    loading,
    error,
    refetch: fetchWorkers,
    createWorker,
    updateWorker,
    deleteWorker,
  };
}
