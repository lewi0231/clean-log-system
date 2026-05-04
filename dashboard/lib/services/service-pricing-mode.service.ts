import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { ServicePricingMode } from "@/lib/types";
import type {
  ListServicePricingModesRequest,
  UpsertServicePricingModeRequest,
} from "@/lib/types/api";

export class ServicePricingModeService {
  static async list(request: ListServicePricingModesRequest): Promise<ServicePricingMode[]> {
    try {
      log.debug("ServicePricingModeService: listing service pricing modes", {
        organizationId: request.organization_id,
        locationId: request.location_id,
      });

      const data = await invokeTypedEdge("list-service-pricing-modes", request);

      if (!data?.success) {
        throw new Error(data?.error || "Failed to list service pricing modes");
      }

      return data.service_pricing_modes || [];
    } catch (err) {
      log.error("ServicePricingModeService: Failed to list service pricing modes", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async upsert(request: UpsertServicePricingModeRequest): Promise<ServicePricingMode> {
    try {
      log.debug("ServicePricingModeService: upserting service pricing mode", {
        organizationId: request.organization_id,
        serviceTypeFieldConfigId: request.service_type_field_config_id,
        serviceTypeValue: request.service_type_value,
      });

      const data = await invokeTypedEdge("upsert-service-pricing-mode", request);

      if (!data?.success) {
        throw new Error(data?.error || "Failed to upsert service pricing mode");
      }

      if (!data.service_pricing_mode) {
        throw new Error(data?.error || "Failed to upsert service pricing mode");
      }

      return data.service_pricing_mode;
    } catch (err) {
      log.error("ServicePricingModeService: Failed to upsert service pricing mode", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      log.debug("ServicePricingModeService: deleting service pricing mode", {
        id,
      });

      const data = await invokeTypedEdge("delete-service-pricing-mode", {
        id,
      });

      if (!data?.success) {
        throw new Error(data?.error || "Failed to delete service pricing mode");
      }
    } catch (err) {
      log.error("ServicePricingModeService: Failed to delete service pricing mode", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
