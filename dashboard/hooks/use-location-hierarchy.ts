"use client";

import { LocationHierarchyService } from "@/lib/services";
import type {
  LocationHierarchyAssignment,
  LocationHierarchyNode,
} from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseLocationHierarchyResult {
  nodes: LocationHierarchyNode[];
  assignments: LocationHierarchyAssignment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLocationHierarchy(): UseLocationHierarchyResult {
  const { organizationId } = useOrganization();
  const [nodes, setNodes] = useState<LocationHierarchyNode[]>([]);
  const [assignments, setAssignments] = useState<LocationHierarchyAssignment[]>(
    []
  );
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
      setAssignments(response.assignments);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load location hierarchy"
      );
      setNodes([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return {
    nodes,
    assignments,
    loading,
    error,
    refetch: fetchHierarchy,
  };
}
