import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { LocationHierarchyNode } from "@/lib/types";
import type {
  CreateLocationHierarchyRequest,
  DeleteLocationHierarchyRequest,
  ListLocationHierarchyRequest,
  UpdateLocationHierarchyRequest,
} from "@/lib/types/api";

export class LocationHierarchyService {
  static async list(
    request: ListLocationHierarchyRequest
  ): Promise<{ nodes: LocationHierarchyNode[] }> {
    try {
      log.debug("LocationHierarchyService: listing nodes", {
        organizationId: request.organization_id,
      });

      const data = await invokeTypedEdge("list-location-hierarchy", request);

      if (!data || !data.success) {
        throw new Error("Failed to list location hierarchy");
      }

      return {
        nodes: data.nodes ?? [],
      };
    } catch (err) {
      log.error("LocationHierarchyService: Failed to list hierarchy", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async create(request: CreateLocationHierarchyRequest): Promise<LocationHierarchyNode> {
    try {
      log.debug("LocationHierarchyService: creating node", {
        name: request.name,
        type: request.type,
      });

      const data = await invokeTypedEdge("create-location-hierarchy", request);

      if (!data || !data.success || !data.node) {
        throw new Error("Failed to create location hierarchy node");
      }

      return data.node;
    } catch (err) {
      log.error("LocationHierarchyService: Failed to create node", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async update(request: UpdateLocationHierarchyRequest): Promise<LocationHierarchyNode> {
    try {
      log.debug("LocationHierarchyService: updating node", {
        id: request.id,
      });

      const data = await invokeTypedEdge("update-location-hierarchy", request);

      if (!data || !data.success || !data.node) {
        throw new Error("Failed to update location hierarchy node");
      }

      return data.node;
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

      const data = await invokeTypedEdge("delete-location-hierarchy", request);

      if (!data || !data.success) {
        throw new Error(data?.message || "Failed to delete location hierarchy node");
      }
    } catch (err) {
      log.error("LocationHierarchyService: Failed to delete node", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
