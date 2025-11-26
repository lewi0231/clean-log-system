import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { FieldPricing } from "@/lib/types";

export interface ListFieldPricingRequest {
  organization_id: string;
}

export interface UpsertFieldPricingRequest {
  organization_id: string;
  field_config_id: string;
  unit_price: number;
  currency?: string;
}

export interface DeleteFieldPricingRequest {
  id: string;
}

export class FieldPricingService {
  /**
   * List field pricing for an organization
   */
  static async list(request: ListFieldPricingRequest): Promise<FieldPricing[]> {
    try {
      log.debug("FieldPricingService: Fetching field pricing", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-field-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.field_pricing) {
        throw new Error("Failed to fetch field pricing");
      }

      log.info("FieldPricingService: Field pricing fetched successfully", {
        fieldPricingCount: data.field_pricing.length,
      });
      return data.field_pricing as FieldPricing[];
    } catch (err) {
      log.error("FieldPricingService: Failed to fetch field pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create or update field pricing
   */
  static async upsert(
    request: UpsertFieldPricingRequest
  ): Promise<FieldPricing> {
    try {
      log.debug("FieldPricingService: Upserting field pricing", {
        organizationId: request.organization_id,
        fieldConfigId: request.field_config_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "upsert-field-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.field_pricing) {
        throw new Error("Failed to upsert field pricing");
      }

      log.info("FieldPricingService: Field pricing upserted successfully");
      return data.field_pricing as FieldPricing;
    } catch (err) {
      log.error("FieldPricingService: Failed to upsert field pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Delete field pricing
   */
  static async delete(request: DeleteFieldPricingRequest): Promise<void> {
    try {
      log.debug("FieldPricingService: Deleting field pricing", {
        id: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "delete-field-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error("Failed to delete field pricing");
      }

      log.info("FieldPricingService: Field pricing deleted successfully");
    } catch (err) {
      log.error("FieldPricingService: Failed to delete field pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
