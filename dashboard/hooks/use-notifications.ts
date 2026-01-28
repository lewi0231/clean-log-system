"use client";

import {
  NotificationService,
  type Notification,
} from "@/lib/services/notification.service";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { organizationId, organizationUserId } = useOrganization();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!organizationId || !organizationUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await NotificationService.getNotifications(
        organizationId,
        organizationUserId
      );
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  }, [organizationId, organizationUserId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refetch when user returns to the tab (covers Realtime gaps and ensures fresh data)
  useEffect(() => {
    const handleFocus = () => {
      void fetchNotifications();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchNotifications]);

  // Realtime: refetch when a new notification is inserted for this user
  useEffect(() => {
    if (!organizationUserId) return;

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `receiver_id=eq.${organizationUserId}`,
        },
        () => {
          void fetchNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationUserId, fetchNotifications]);

  // Fallback poll every 30 seconds (e.g. if Realtime is not enabled for table)
  useEffect(() => {
    if (!organizationId || !organizationUserId) return;

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [organizationId, organizationUserId, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!organizationId || !organizationUserId) return;

    try {
      await NotificationService.markAllAsRead(organizationId, organizationUserId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
