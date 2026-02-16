/**
 * Notification utilities for Edge Functions
 * Creates and manages in-app notifications for organization admins
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { createLoggerWithoutRequest } from "./logger.ts";

export type NotificationType =
  | "worker_active"
  | "job_completed"
  | "invoice_generated"
  | "payment_received"
  | "review_submitted"
  | "admin_activated"
  | "worker_created"
  // Job colleague confirmation workflow types
  | "job_confirmation_requested"
  | "job_confirmation_reminder"
  | "job_flagged"
  | "job_withdrawn"
  | "job_resolved_approved"
  | "job_resolved_cancelled"
  | "job_auto_approved"
  | "job_colleagues_confirmed";

export interface CreateNotificationParams {
  organization_id: string;
  receiver_id?: string; // null = broadcast to all admins in org
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface CreateNotificationResult {
  success: boolean;
  error?: string;
  notificationCount?: number;
}

/**
 * Create a notification for one or all admins in an organization
 *
 * If receiver_id is not specified, creates notifications for all admins/owners.
 * This is a non-blocking operation - callers should log errors but not fail.
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationParams,
): Promise<CreateNotificationResult> {
  const logger = createLoggerWithoutRequest({ functionName: "createNotification" });
  try {
    // If receiver_id is not specified, create notifications for all admins
    if (!params.receiver_id) {
      const { data: admins, error: adminError } = await supabase
        .from("organization_user")
        .select("id")
        .eq("organization_id", params.organization_id)
        .in("role", ["admin", "owner"]);

      if (adminError) {
        return { success: false, error: adminError.message };
      }

      if (!admins || admins.length === 0) {
        logger.debug("No admins/owners found for org", {
          organization_id: params.organization_id,
          type: params.type,
        });
        return { success: true, notificationCount: 0 };
      }

      // Create notification for each admin
      const notifications = admins.map((admin) => ({
        organization_id: params.organization_id,
        receiver_id: admin.id,
        type: params.type,
        title: params.title,
        message: params.message,
        related_entity_type: params.related_entity_type,
        related_entity_id: params.related_entity_id,
      }));

      const { error } = await supabase
        .from("notification")
        .insert(notifications);

      if (error) {
        logger.warn("Insert failed", {
          organization_id: params.organization_id,
          type: params.type,
          error: error.message,
        });
        return { success: false, error: error.message };
      }

      logger.debug("Created notifications for admins", {
        organization_id: params.organization_id,
        type: params.type,
        notificationCount: notifications.length,
      });
      return { success: true, notificationCount: notifications.length };
    } else {
      // Single notification for specific user
      const { error } = await supabase.from("notification").insert([{
        organization_id: params.organization_id,
        receiver_id: params.receiver_id,
        type: params.type,
        title: params.title,
        message: params.message,
        related_entity_type: params.related_entity_type,
        related_entity_id: params.related_entity_id,
      }]);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, notificationCount: 1 };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("notification")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Mark all notifications as read for a user in an organization
 */
export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  organizationId: string,
  receiverId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("notification")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("receiver_id", receiverId)
    .eq("read", false);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
