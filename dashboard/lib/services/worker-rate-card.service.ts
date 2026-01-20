/**
 * Worker Rate Card Service
 * Handles CRUD operations for worker payment rate cards with modifier types
 * Uses edge function to bypass RLS (service_role only)
 */

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export type ModifierType = "per_unit" | "flat" | "multiplier" | "team_percentage";

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
    const { data, error } = await supabase.functions.invoke(
      "manage-worker-rate-card",
      {
        body: {
          action: "list",
          organization_id: organizationId,
        },
      }
    );

    if (error) {
      log.error("WorkerRateCardService: Failed to list rate cards", {
        error: error.message,
      });
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to list rate cards");
    }

    return (data.rate_cards || []) as WorkerRateCard[];
  }

  /**
   * Get rate cards for a specific worker
   * Note: Uses list and filters client-side for now
   */
  static async getForWorker(
    organizationId: string,
    workerId: string
  ): Promise<WorkerRateCard[]> {
    const allCards = await this.list(organizationId);
    return allCards
      .filter((card) => card.worker_id === workerId)
      .sort(
        (a, b) =>
          new Date(b.effective_from).getTime() -
          new Date(a.effective_from).getTime()
      );
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
    const workerCards = await this.getForWorker(organizationId, workerId);

    const activeCard = workerCards.find((card) => {
      if (!card.is_active) return false;
      if (card.effective_from > today) return false;
      if (card.effective_to && card.effective_to < today) return false;
      if (modifierType && card.modifier_type !== modifierType) return false;
      return true;
    });

    return activeCard || null;
  }

  /**
   * Create a new rate card
   */
  static async create(request: CreateRateCardRequest): Promise<WorkerRateCard> {
    const { data, error } = await supabase.functions.invoke(
      "manage-worker-rate-card",
      {
        body: {
          action: "create",
          organization_id: request.organization_id,
          worker_id: request.worker_id,
          modifier_type: request.modifier_type,
          modifier_value: request.modifier_value,
          currency: request.currency,
          effective_from: request.effective_from,
          effective_to: request.effective_to,
          role_title: request.role_title,
          notes: request.notes,
          field_config_ids: request.field_config_ids,
        },
      }
    );

    if (error) {
      log.error("WorkerRateCardService: Failed to create rate card", {
        error: error.message,
      });
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to create rate card");
    }

    return data.rate_card as WorkerRateCard;
  }

  /**
   * Update a rate card
   */
  static async update(
    organizationId: string,
    request: UpdateRateCardRequest
  ): Promise<WorkerRateCard> {
    const { data, error } = await supabase.functions.invoke(
      "manage-worker-rate-card",
      {
        body: {
          action: "update",
          organization_id: organizationId,
          id: request.id,
          modifier_type: request.modifier_type,
          modifier_value: request.modifier_value,
          effective_from: request.effective_from,
          effective_to: request.effective_to,
          role_title: request.role_title,
          is_active: request.is_active,
          notes: request.notes,
          field_config_ids: request.field_config_ids,
        },
      }
    );

    if (error) {
      log.error("WorkerRateCardService: Failed to update rate card", {
        error: error.message,
        id: request.id,
      });
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to update rate card");
    }

    return data.rate_card as WorkerRateCard;
  }

  /**
   * Deactivate a rate card (soft delete)
   */
  static async deactivate(organizationId: string, id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke(
      "manage-worker-rate-card",
      {
        body: {
          action: "deactivate",
          organization_id: organizationId,
          id,
        },
      }
    );

    if (error) {
      log.error("WorkerRateCardService: Failed to deactivate rate card", {
        error: error.message,
        id,
      });
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to deactivate rate card");
    }
  }

  /**
   * Delete a rate card (hard delete)
   */
  static async delete(organizationId: string, id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke(
      "manage-worker-rate-card",
      {
        body: {
          action: "delete",
          organization_id: organizationId,
          id,
        },
      }
    );

    if (error) {
      log.error("WorkerRateCardService: Failed to delete rate card", {
        error: error.message,
        id,
      });
      throw new Error(error.message);
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to delete rate card");
    }
  }
}
