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
  resendInvitation: (workerId: string, organizationId: string) => Promise<void>;
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

  const resendInvitation = async (
    workerId: string,
    orgId: string
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
    resendInvitation,
  };
}
