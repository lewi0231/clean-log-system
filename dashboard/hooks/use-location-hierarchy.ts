"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { locationHierarchyKey } from "@/app/query-provider";
import { LocationHierarchyService } from "@/lib/services";
import type { LocationHierarchyNode } from "@/lib/types";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface CreateNodeParams {
  name: string;
  type: "company" | "region";
  parent_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface UpdateNodeParams {
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

interface UseLocationHierarchyResult {
  nodes: LocationHierarchyNode[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createNode: (params: CreateNodeParams) => Promise<LocationHierarchyNode>;
  updateNode: (params: UpdateNodeParams) => Promise<LocationHierarchyNode>;
  deleteNode: (id: string) => Promise<void>;
}

async function fetchLocationHierarchy(
  organizationId: string,
): Promise<LocationHierarchyNode[]> {
  const response = await LocationHierarchyService.list({
    organization_id: organizationId,
  });
  return response.nodes;
}

export function useLocationHierarchy(): UseLocationHierarchyResult {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: locationHierarchyKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchLocationHierarchy(organizationId as string),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: locationHierarchyKey(organizationId),
    });
  }, [queryClient, organizationId]);

  const createMutation = useMutation({
    mutationFn: async (params: CreateNodeParams) => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }
      return LocationHierarchyService.create({
        organization_id: organizationId,
        ...params,
      });
    },
    onSuccess: () => {
      invalidateCache();
    },
  });

  const updateMutation = useMutation({
    mutationFn: LocationHierarchyService.update,
    onSuccess: () => {
      invalidateCache();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => LocationHierarchyService.delete({ id }),
    onSuccess: () => {
      invalidateCache();
    },
  });

  const createNode = useCallback(
    async (params: CreateNodeParams): Promise<LocationHierarchyNode> => {
      const newNode = await createMutation.mutateAsync(params);
      await query.refetch();
      return newNode;
    },
    [createMutation, query],
  );

  const updateNode = useCallback(
    async (params: UpdateNodeParams): Promise<LocationHierarchyNode> => {
      const updatedNode = await updateMutation.mutateAsync(params);
      await query.refetch();
      return updatedNode;
    },
    [updateMutation, query],
  );

  const deleteNode = useCallback(
    async (id: string): Promise<void> => {
      await deleteMutation.mutateAsync(id);
      await query.refetch();
    },
    [deleteMutation, query],
  );

  return {
    nodes: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    createNode,
    updateNode,
    deleteNode,
  };
}
