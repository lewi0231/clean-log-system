/**
 * Worker Rate Card Service
 * Handles CRUD operations for worker payment rate cards
 */

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export interface WorkerRateCard {
  id: string;
  organization_id: string;
  worker_id: string;
  hourly_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  rate_type: "standard" | "overtime" | "holiday";
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
}

export interface CreateRateCardRequest {
  organization_id: string;
  worker_id: string;
  hourly_rate: number;
  currency?: string;
  effective_from?: string;
  effective_to?: string | null;
  rate_type?: "standard" | "overtime" | "holiday";
  role_title?: string | null;
  notes?: string | null;
}

export interface UpdateRateCardRequest {
  id: string;
  hourly_rate?: number;
  effective_from?: string;
  effective_to?: string | null;
  rate_type?: "standard" | "overtime" | "holiday";
  role_title?: string | null;
  is_active?: boolean;
  notes?: string | null;
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

    return (data || []) as WorkerRateCard[];
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
      .select("*")
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

    return (data || []) as WorkerRateCard[];
  }

  /**
   * Get the current active rate card for a worker
   */
  static async getCurrentRate(
    organizationId: string,
    workerId: string,
    rateType: "standard" | "overtime" | "holiday" = "standard"
  ): Promise<WorkerRateCard | null> {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("worker_rate_card")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("worker_id", workerId)
      .eq("rate_type", rateType)
      .eq("is_active", true)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error("WorkerRateCardService: Failed to get current rate", {
        error: error.message,
        workerId,
      });
      throw new Error(error.message);
    }

    return data as WorkerRateCard | null;
  }

  /**
   * Create a new rate card
   */
  static async create(request: CreateRateCardRequest): Promise<WorkerRateCard> {
    const { data, error } = await supabase
      .from("worker_rate_card")
      .insert({
        organization_id: request.organization_id,
        worker_id: request.worker_id,
        hourly_rate: request.hourly_rate,
        currency: request.currency || "AUD",
        effective_from: request.effective_from || new Date().toISOString().split("T")[0],
        effective_to: request.effective_to || null,
        rate_type: request.rate_type || "standard",
        role_title: request.role_title || null,
        notes: request.notes || null,
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

    return data as WorkerRateCard;
  }

  /**
   * Update a rate card
   */
  static async update(request: UpdateRateCardRequest): Promise<WorkerRateCard> {
    const { id, ...updateData } = request;

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

    return data as WorkerRateCard;
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
