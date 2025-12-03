"use client";

import { LocationHierarchyService } from "@/lib/services";
import type { LocationHierarchyNode } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
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

export function useLocationHierarchy(): UseLocationHierarchyResult {
  const { organizationId } = useOrganization();
  const [nodes, setNodes] = useState<LocationHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await LocationHierarchyService.list({
        organization_id: organizationId,
      });

      setNodes(response.nodes);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load location hierarchy",
      );
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const createNode = useCallback(
    async (params: CreateNodeParams): Promise<LocationHierarchyNode> => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const newNode = await LocationHierarchyService.create({
        organization_id: organizationId,
        ...params,
      });

      // Optimistically add to state
      setNodes((prev) => [...prev, newNode]);

      return newNode;
    },
    [organizationId],
  );

  const updateNode = useCallback(
    async (params: UpdateNodeParams): Promise<LocationHierarchyNode> => {
      const updatedNode = await LocationHierarchyService.update(params);

      // Optimistically update state
      setNodes((prev) =>
        prev.map((node) => (node.id === params.id ? updatedNode : node))
      );

      return updatedNode;
    },
    [],
  );

  const deleteNode = useCallback(async (id: string): Promise<void> => {
    await LocationHierarchyService.delete({ id });

    // Optimistically remove from state
    setNodes((prev) => prev.filter((node) => node.id !== id));
  }, []);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return {
    nodes,
    loading,
    error,
    refetch: fetchHierarchy,
    createNode,
    updateNode,
    deleteNode,
  };
}
