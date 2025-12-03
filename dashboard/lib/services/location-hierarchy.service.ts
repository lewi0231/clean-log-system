import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { LocationHierarchyNode } from "@/lib/types";

interface ListLocationHierarchyRequest {
  organization_id: string;
}

interface ListLocationHierarchyResponse {
  nodes: LocationHierarchyNode[];
}

interface CreateLocationHierarchyRequest {
  organization_id: string;
  name: string;
  type: "company" | "region";
  parent_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface UpdateLocationHierarchyRequest {
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

interface DeleteLocationHierarchyRequest {
  id: string;
}

export class LocationHierarchyService {
  static async list(
    request: ListLocationHierarchyRequest,
  ): Promise<ListLocationHierarchyResponse> {
    try {
      log.debug("LocationHierarchyService: listing nodes", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-location-hierarchy",
        {
          body: request,
        },
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error("Failed to list location hierarchy");
      }

      return {
        nodes: data.nodes as LocationHierarchyNode[],
      };
    } catch (err) {
      log.error("LocationHierarchyService: Failed to list hierarchy", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async create(
    request: CreateLocationHierarchyRequest,
  ): Promise<LocationHierarchyNode> {
    try {
      log.debug("LocationHierarchyService: creating node", {
        name: request.name,
        type: request.type,
      });

      const { data, error } = await supabase.functions.invoke(
        "create-location-hierarchy",
        {
          body: request,
        },
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error("Failed to create location hierarchy node");
      }

      return data.node as LocationHierarchyNode;
    } catch (err) {
      log.error("LocationHierarchyService: Failed to create node", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async update(
    request: UpdateLocationHierarchyRequest,
  ): Promise<LocationHierarchyNode> {
    try {
      log.debug("LocationHierarchyService: updating node", {
        id: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "update-location-hierarchy",
        {
          body: request,
        },
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error("Failed to update location hierarchy node");
      }

      return data.node as LocationHierarchyNode;
    } catch (err) {
      log.error("LocationHierarchyService: Failed to update node", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async delete(request: DeleteLocationHierarchyRequest): Promise<void> {
    try {
      log.debug("LocationHierarchyService: deleting node", {
        id: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "delete-location-hierarchy",
        {
          body: request,
        },
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(
          data?.message || "Failed to delete location hierarchy node",
        );
      }
    } catch (err) {
      log.error("LocationHierarchyService: Failed to delete node", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
