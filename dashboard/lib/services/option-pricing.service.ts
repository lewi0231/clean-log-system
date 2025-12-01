import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { OptionPricing } from "@/lib/types";

export interface ListOptionPricingRequest {
  organization_id: string;
  field_config_id?: string;
  location_id?: string | null;
}

export interface UpsertOptionPricingRequest {
  organization_id: string;
  field_config_id: string;
  option_value: string;
  customer_price: number;
  worker_payment_rate?: number | null;
  location_id?: string | null;
  currency?: string;
}

export interface DeleteOptionPricingRequest {
  id: string;
}

export class OptionPricingService {
  /**
   * List option pricing for an organization
   */
  static async list(
    request: ListOptionPricingRequest
  ): Promise<OptionPricing[]> {
    try {
      log.debug("OptionPricingService: Fetching option pricing", {
        organizationId: request.organization_id,
        fieldConfigId: request.field_config_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-option-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.option_pricing) {
        throw new Error("Failed to fetch option pricing");
      }

      log.info("OptionPricingService: Option pricing fetched successfully", {
        optionPricingCount: data.option_pricing.length,
      });
      return data.option_pricing as OptionPricing[];
    } catch (err) {
      log.error("OptionPricingService: Failed to fetch option pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create or update option pricing
   */
  static async upsert(
    request: UpsertOptionPricingRequest
  ): Promise<OptionPricing> {
    try {
      log.debug("OptionPricingService: Upserting option pricing", {
        organizationId: request.organization_id,
        fieldConfigId: request.field_config_id,
        optionValue: request.option_value,
      });

      // Build request body, excluding null/undefined location_id
      const body: Record<string, unknown> = {
        organization_id: request.organization_id,
        field_config_id: request.field_config_id,
        option_value: request.option_value,
        customer_price: request.customer_price,
        currency: request.currency || "USD",
      };

      // Only include location_id if it's a valid string
      if (request.location_id !== null && request.location_id !== undefined) {
        body.location_id = request.location_id;
      }

      // Only include worker_payment_rate if it's defined
      if (
        request.worker_payment_rate !== null &&
        request.worker_payment_rate !== undefined
      ) {
        body.worker_payment_rate = request.worker_payment_rate;
      }

      const { data, error } = await supabase.functions.invoke(
        "upsert-option-pricing",
        {
          body,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.option_pricing) {
        throw new Error("Failed to upsert option pricing");
      }

      log.info("OptionPricingService: Option pricing upserted successfully");
      return data.option_pricing as OptionPricing;
    } catch (err) {
      log.error("OptionPricingService: Failed to upsert option pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Delete option pricing
   */
  static async delete(request: DeleteOptionPricingRequest): Promise<void> {
    try {
      log.debug("OptionPricingService: Deleting option pricing", {
        id: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "delete-option-pricing",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error("Failed to delete option pricing");
      }

      log.info("OptionPricingService: Option pricing deleted successfully");
    } catch (err) {
      log.error("OptionPricingService: Failed to delete option pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
