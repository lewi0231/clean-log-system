"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { notificationsKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { NotificationService, type Notification } from "@/lib/services/notification.service";
import useOrganization from "./useOrganization";
import { useRealtimeNotifications } from "./use-realtime-notifications";

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
  const queryClient = useQueryClient();

  // Subscribe to real-time notification changes (auto-invalidates cache)
  useRealtimeNotifications(organizationId, organizationUserId ?? null);

  useEffect(() => {
    log.debug("useNotifications: enabled state", {
      organizationId,
      organizationUserId,
      queryEnabled: !!organizationId && !!organizationUserId,
    });
  }, [organizationId, organizationUserId]);

  // Fetch notifications using React Query
  const query = useQuery({
    queryKey: notificationsKey(organizationId, organizationUserId ?? null),
    enabled: !!organizationId && !!organizationUserId,
    queryFn: () => NotificationService.getNotifications(organizationId!, organizationUserId!),
    // Notifications are time-sensitive, use shorter stale time
    staleTime: 30_000, // 30 seconds
    // Refetch on window focus for notifications (override global default)
    refetchOnWindowFocus: true,
  });

  // Mutation for marking single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => NotificationService.markAsRead(notificationId),
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: notificationsKey(organizationId, organizationUserId ?? null),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(
        notificationsKey(organizationId, organizationUserId ?? null)
      );

      // Optimistically update
      queryClient.setQueryData(
        notificationsKey(organizationId, organizationUserId ?? null),
        (old: { notifications: Notification[]; unreadCount: number } | undefined) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );

      return { previousData };
    },
    onError: (err, notificationId, context) => {
      log.error("Notifications: Failed to mark as read", {
        error: err instanceof Error ? err.message : "Unknown error",
        notificationId,
      });
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          notificationsKey(organizationId, organizationUserId ?? null),
          context.previousData
        );
      }
    },
  });

  // Mutation for marking all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => NotificationService.markAllAsRead(organizationId!, organizationUserId!),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: notificationsKey(organizationId, organizationUserId ?? null),
      });

      const previousData = queryClient.getQueryData(
        notificationsKey(organizationId, organizationUserId ?? null)
      );

      // Optimistically mark all as read
      queryClient.setQueryData(
        notificationsKey(organizationId, organizationUserId ?? null),
        (old: { notifications: Notification[]; unreadCount: number } | undefined) => {
          if (!old) return old;
          return {
            notifications: old.notifications.map((n) => ({
              ...n,
              read: true,
              read_at: new Date().toISOString(),
            })),
            unreadCount: 0,
          };
        }
      );

      return { previousData };
    },
    onError: (err, _, context) => {
      log.error("Notifications: Failed to mark all as read", {
        error: err instanceof Error ? err.message : "Unknown error",
        organizationId,
        organizationUserId,
      });
      if (context?.previousData) {
        queryClient.setQueryData(
          notificationsKey(organizationId, organizationUserId ?? null),
          context.previousData
        );
      }
    },
  });

  const markAsRead = async (notificationId: string) => {
    await markAsReadMutation.mutateAsync(notificationId);
  };

  const markAllAsRead = async () => {
    if (!organizationId || !organizationUserId) return;
    await markAllAsReadMutation.mutateAsync();
  };

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch().then(() => undefined),
    markAsRead,
    markAllAsRead,
  };
}
