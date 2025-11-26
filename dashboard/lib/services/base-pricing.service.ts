import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { BasePricing } from "@/lib/types";

export interface ListBasePricingRequest {
  organization_id: string;
  location_id?: string | null;
}

export interface UpsertBasePricingRequest {
  organization_id: string;
  job_type_field_config_id?: string | null;
  job_type_value?: string | null;
  standalone_base_price?: number | null;
  customer_base_price: number;
  worker_base_payment?: number | null;
  location_id?: string | null;
  currency?: string;
}

export interface DeleteBasePricingRequest {
  id: string;
}

export class BasePricingService {
  /**
   * List base pricing for an organization
   */
  static async list(request: ListBasePricingRequest): Promise<BasePricing[]> {
    try {
      log.debug("BasePricingService: Fetching base pricing", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-base-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.base_pricing) {
        throw new Error("Failed to fetch base pricing");
      }

      log.info("BasePricingService: Base pricing fetched successfully", {
        basePricingCount: data.base_pricing.length,
      });
      return data.base_pricing as BasePricing[];
    } catch (err) {
      log.error("BasePricingService: Failed to fetch base pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create or update base pricing
   */
  static async upsert(request: UpsertBasePricingRequest): Promise<BasePricing> {
    try {
      log.debug("BasePricingService: Upserting base pricing", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "upsert-base-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.base_pricing) {
        throw new Error("Failed to upsert base pricing");
      }

      log.info("BasePricingService: Base pricing upserted successfully");
      return data.base_pricing as BasePricing;
    } catch (err) {
      log.error("BasePricingService: Failed to upsert base pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Delete base pricing
   */
  static async delete(request: DeleteBasePricingRequest): Promise<void> {
    try {
      log.debug("BasePricingService: Deleting base pricing", {
        id: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "delete-base-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error("Failed to delete base pricing");
      }

      log.info("BasePricingService: Base pricing deleted successfully");
    } catch (err) {
      log.error("BasePricingService: Failed to delete base pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
