import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
  LocationHierarchyAssignment,
  LocationHierarchyNode,
} from "@/lib/types";

interface ListLocationHierarchyRequest {
  organization_id: string;
}

interface ListLocationHierarchyResponse {
  nodes: LocationHierarchyNode[];
  assignments: LocationHierarchyAssignment[];
}

export class LocationHierarchyService {
  static async list(
    request: ListLocationHierarchyRequest
  ): Promise<ListLocationHierarchyResponse> {
    try {
      log.debug("LocationHierarchyService: listing nodes", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-location-hierarchy",
        {
          body: request,
        }
      );

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error("Failed to list location hierarchy");
      }

      return {
        nodes: data.nodes as LocationHierarchyNode[],
        assignments: data.assignments as LocationHierarchyAssignment[],
      };
    } catch (err) {
      log.error("LocationHierarchyService: Failed to list hierarchy", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
