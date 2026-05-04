import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { ListFieldConfigsRequest } from "@/lib/types/api";
import type { FieldConfig } from "@clean-log/shared/types";

export class FieldConfigsService {
  /**
   * List field configs for an organization
   */
  static async list(request: ListFieldConfigsRequest): Promise<FieldConfig[]> {
    try {
      log.debug("FieldConfigsService: Fetching field configs", {
        organizationId: request.organization_id,
      });

      const data = await invokeTypedEdge("list-field-configs", request);

      if (!data || !data.field_configs) {
        throw new Error("Failed to fetch field configs");
      }

      log.info("FieldConfigsService: Field configs fetched successfully", {
        fieldConfigsCount: data.field_configs.length,
      });
      return data.field_configs;
    } catch (err) {
      log.error("FieldConfigsService: Failed to fetch field configs", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
