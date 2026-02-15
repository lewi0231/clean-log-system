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
    | "job_auto_approved";
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

    // Check auth state before querying
    const {
      data: { session },
    } = await supabase.auth.getSession();

    log.info("NotificationService: Executing query", {
      organizationId,
      receiverId,
      limit,
      hasSession: !!session,
      authUserId: session?.user?.id ?? null,
      accessToken: session?.access_token ? "present" : "missing",
    });

    // DEBUG: Try a simple RPC call to check auth.uid() on the server
    const { data: authCheck, error: authCheckError } = await supabase.rpc(
      "get_current_user_id"
    );
    log.info("NotificationService: Server auth check", {
      serverAuthUid: authCheck,
      error: authCheckError?.message,
    });

    // DEBUG: Check exactly what the RLS subquery returns
    const { data: rlsDebug, error: rlsDebugError } = await supabase.rpc(
      "debug_rls_notification_check"
    );
    log.info("NotificationService: RLS subquery debug", {
      result: rlsDebug,
      error: rlsDebugError?.message,
    });

    // DEBUG: First try without receiver_id filter to see if RLS is the issue
    const { data: allOrgNotifications, error: debugError } = await supabase
      .from("notification")
      .select("id, receiver_id, type")
      .eq("organization_id", organizationId)
      .limit(5);

    log.info("NotificationService: DEBUG - All org notifications (no receiver filter)", {
      count: allOrgNotifications?.length ?? 0,
      notifications: allOrgNotifications,
      error: debugError?.message,
    });

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

    log.info("NotificationService: Query result", {
      organizationId,
      receiverId,
      rowCount: data?.length ?? 0,
      hasData: !!data,
    });

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
  static async getUnreadCount(
    organizationId: string,
    receiverId: string
  ): Promise<number> {
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
  static async markAllAsRead(
    organizationId: string,
    receiverId: string
  ): Promise<void> {
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
