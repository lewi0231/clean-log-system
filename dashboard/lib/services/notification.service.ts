/**
 * Notification Service
 * Handles fetching and managing in-app notifications
 */

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export interface Notification {
  id: string;
  organization_id: string;
  receiver_id: string;
  type:
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
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}

export class NotificationService {
  /**
   * Get notifications for the current user's organization
   */
  static async getNotifications(
    organizationId: string,
    receiverId: string,
    limit: number = 20
  ): Promise<NotificationListResponse> {
    log.debug("NotificationService: Fetching notifications", {
      organizationId,
      receiverId,
      limit,
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      log.warn("NotificationService: No session — notifications require auth");
    }

    const { data, error } = await supabase
      .from("notification")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("receiver_id", receiverId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("NotificationService: Fetch failed", {
        organizationId,
        receiverId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      throw new Error(error.message);
    }

    const notifications = (data || []) as Notification[];
    const unreadCount = notifications.filter((n) => !n.read).length;

    log.debug("NotificationService: Fetch result", {
      organizationId,
      receiverId,
      count: notifications.length,
      unreadCount,
    });

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(organizationId: string, receiverId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notification")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("receiver_id", receiverId)
      .eq("read", false);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from("notification")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(organizationId: string, receiverId: string): Promise<void> {
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
      throw new Error(error.message);
    }
  }
}
