/**
 * Worker Rate Card Service
 * Handles CRUD operations for worker payment rate cards with modifier types
 */

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export type ModifierType = "per_unit" | "flat" | "multiplier";

export interface WorkerRateCard {
  id: string;
  organization_id: string;
  worker_id: string;
  modifier_type: ModifierType;
  modifier_value: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  role_title: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined worker data
  worker?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  // Joined field mappings (for per_unit type)
  field_config_ids?: string[];
  worker_rate_card_field?: { field_config_id: string }[];
}

export interface CreateRateCardRequest {
  organization_id: string;
  worker_id: string;
  modifier_type: ModifierType;
  modifier_value: number;
  currency?: string;
  effective_from?: string;
  effective_to?: string | null;
  role_title?: string | null;
  notes?: string | null;
  field_config_ids?: string[]; // For per_unit type
}

export interface UpdateRateCardRequest {
  id: string;
  modifier_type?: ModifierType;
  modifier_value?: number;
  effective_from?: string;
  effective_to?: string | null;
  role_title?: string | null;
  is_active?: boolean;
  notes?: string | null;
  field_config_ids?: string[]; // For per_unit type
}

export class WorkerRateCardService {
  /**
   * List all rate cards for an organization
   */
  static async list(organizationId: string): Promise<WorkerRateCard[]> {
    const { data, error } = await supabase
      .from("worker_rate_card")
      .select(
        `
        *,
        worker:worker_id (
          id,
          first_name,
          last_name
        ),
        worker_rate_card_field (
          field_config_id
        )
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      log.error("WorkerRateCardService: Failed to list rate cards", {
        error: error.message,
      });
      throw new Error(error.message);
    }

    // Transform field mappings to field_config_ids array
    return (data || []).map((card) => ({
      ...card,
      field_config_ids:
        card.worker_rate_card_field?.map(
          (f: { field_config_id: string }) => f.field_config_id
        ) || [],
    })) as WorkerRateCard[];
  }

  /**
   * Get rate cards for a specific worker
   */
  static async getForWorker(
    organizationId: string,
    workerId: string
  ): Promise<WorkerRateCard[]> {
    const { data, error } = await supabase
      .from("worker_rate_card")
      .select(
        `
        *,
        worker_rate_card_field (
          field_config_id
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("worker_id", workerId)
      .order("effective_from", { ascending: false });

    if (error) {
      log.error("WorkerRateCardService: Failed to get worker rate cards", {
        error: error.message,
        workerId,
      });
      throw new Error(error.message);
    }

    return (data || []).map((card) => ({
      ...card,
      field_config_ids:
        card.worker_rate_card_field?.map(
          (f: { field_config_id: string }) => f.field_config_id
        ) || [],
    })) as WorkerRateCard[];
  }

  /**
   * Get the current active rate card for a worker
   */
  static async getCurrentRate(
    organizationId: string,
    workerId: string,
    modifierType?: ModifierType
  ): Promise<WorkerRateCard | null> {
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("worker_rate_card")
      .select(
        `
        *,
        worker_rate_card_field (
          field_config_id
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("worker_id", workerId)
      .eq("is_active", true)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1);

    if (modifierType) {
      query = query.eq("modifier_type", modifierType);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      log.error("WorkerRateCardService: Failed to get current rate", {
        error: error.message,
        workerId,
      });
      throw new Error(error.message);
    }

    if (!data) return null;

    return {
      ...data,
      field_config_ids:
        data.worker_rate_card_field?.map(
          (f: { field_config_id: string }) => f.field_config_id
        ) || [],
    } as WorkerRateCard;
  }

  /**
   * Create a new rate card
   */
  static async create(request: CreateRateCardRequest): Promise<WorkerRateCard> {
    const { field_config_ids, ...rateCardData } = request;

    // Create the rate card
    const { data, error } = await supabase
      .from("worker_rate_card")
      .insert({
        organization_id: rateCardData.organization_id,
        worker_id: rateCardData.worker_id,
        modifier_type: rateCardData.modifier_type,
        modifier_value: rateCardData.modifier_value,
        currency: rateCardData.currency || "AUD",
        effective_from:
          rateCardData.effective_from ||
          new Date().toISOString().split("T")[0],
        effective_to: rateCardData.effective_to || null,
        role_title: rateCardData.role_title || null,
        notes: rateCardData.notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      log.error("WorkerRateCardService: Failed to create rate card", {
        error: error.message,
      });
      throw new Error(error.message);
    }

    // If per_unit type and field_config_ids provided, create field mappings
    if (
      rateCardData.modifier_type === "per_unit" &&
      field_config_ids &&
      field_config_ids.length > 0
    ) {
      const fieldMappings = field_config_ids.map((fieldConfigId) => ({
        rate_card_id: data.id,
        field_config_id: fieldConfigId,
      }));

      const { error: mappingError } = await supabase
        .from("worker_rate_card_field")
        .insert(fieldMappings);

      if (mappingError) {
        log.error(
          "WorkerRateCardService: Failed to create field mappings",
          {
            error: mappingError.message,
          }
        );
        // Don't throw - rate card was created, just log the error
      }
    }

    return {
      ...data,
      field_config_ids: field_config_ids || [],
    } as WorkerRateCard;
  }

  /**
   * Update a rate card
   */
  static async update(request: UpdateRateCardRequest): Promise<WorkerRateCard> {
    const { id, field_config_ids, ...updateData } = request;

    // Update the rate card
    const { data, error } = await supabase
      .from("worker_rate_card")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("WorkerRateCardService: Failed to update rate card", {
        error: error.message,
        id,
      });
      throw new Error(error.message);
    }

    // If field_config_ids provided, update field mappings
    if (field_config_ids !== undefined) {
      // Delete existing mappings
      await supabase
        .from("worker_rate_card_field")
        .delete()
        .eq("rate_card_id", id);

      // Create new mappings if any
      if (field_config_ids.length > 0) {
        const fieldMappings = field_config_ids.map((fieldConfigId) => ({
          rate_card_id: id,
          field_config_id: fieldConfigId,
        }));

        const { error: mappingError } = await supabase
          .from("worker_rate_card_field")
          .insert(fieldMappings);

        if (mappingError) {
          log.error(
            "WorkerRateCardService: Failed to update field mappings",
            {
              error: mappingError.message,
            }
          );
        }
      }
    }

    return {
      ...data,
      field_config_ids: field_config_ids || [],
    } as WorkerRateCard;
  }

  /**
   * Deactivate a rate card (soft delete)
   */
  static async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from("worker_rate_card")
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      log.error("WorkerRateCardService: Failed to deactivate rate card", {
        error: error.message,
        id,
      });
      throw new Error(error.message);
    }
  }

  /**
   * Delete a rate card (hard delete)
   */
  static async delete(id: string): Promise<void> {
    // Field mappings will be cascade deleted due to FK constraint
    const { error } = await supabase
      .from("worker_rate_card")
      .delete()
      .eq("id", id);

    if (error) {
      log.error("WorkerRateCardService: Failed to delete rate card", {
        error: error.message,
        id,
      });
      throw new Error(error.message);
    }
  }
}
