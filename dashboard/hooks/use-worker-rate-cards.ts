"use client";

import {
  WorkerRateCardService,
  type WorkerRateCard,
  type CreateRateCardRequest,
  type UpdateRateCardRequest,
} from "@/lib/services/worker-rate-card.service";
import { useCallback, useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseWorkerRateCardsResult {
  rateCards: WorkerRateCard[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRateCard: (
    request: Omit<CreateRateCardRequest, "organization_id">
  ) => Promise<WorkerRateCard>;
  updateRateCard: (request: UpdateRateCardRequest) => Promise<WorkerRateCard>;
  deactivateRateCard: (id: string) => Promise<void>;
  deleteRateCard: (id: string) => Promise<void>;
}

export function useWorkerRateCards(): UseWorkerRateCardsResult {
  const { organizationId } = useOrganization();
  const [rateCards, setRateCards] = useState<WorkerRateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRateCards = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await WorkerRateCardService.list(organizationId);
      setRateCards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rate cards");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchRateCards();
  }, [fetchRateCards]);

  const createRateCard = async (
    request: Omit<CreateRateCardRequest, "organization_id">
  ): Promise<WorkerRateCard> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const rateCard = await WorkerRateCardService.create({
      ...request,
      organization_id: organizationId,
    });

    await fetchRateCards();
    return rateCard;
  };

  const updateRateCard = async (
    request: UpdateRateCardRequest
  ): Promise<WorkerRateCard> => {
    const rateCard = await WorkerRateCardService.update(request);
    await fetchRateCards();
    return rateCard;
  };

  const deactivateRateCard = async (id: string): Promise<void> => {
    await WorkerRateCardService.deactivate(id);
    await fetchRateCards();
  };

  const deleteRateCard = async (id: string): Promise<void> => {
    await WorkerRateCardService.delete(id);
    await fetchRateCards();
  };

  return {
    rateCards,
    loading,
    error,
    refetch: fetchRateCards,
    createRateCard,
    updateRateCard,
    deactivateRateCard,
    deleteRateCard,
  };
}
