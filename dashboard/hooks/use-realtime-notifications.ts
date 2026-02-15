"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { notificationsKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Hook to subscribe to real-time notification changes.
 * Automatically invalidates the notifications React Query cache
 * when notifications are inserted or updated.
 *
 * This enables real-time updates when:
 * - A new notification is created
 * - A notification is marked as read (from another client/tab)
 */
export function useRealtimeNotifications(
  organizationId: string | null,
  receiverId: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId || !receiverId) return;

    const channelName = `notifications:${receiverId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "notification",
          filter: `receiver_id=eq.${receiverId}`,
        },
        (payload) => {
          log.debug("Realtime: Notification change received", {
            event: payload.eventType,
            receiverId,
          });

          // Refetch to ensure notification bell updates immediately
          void queryClient.refetchQueries({
            queryKey: notificationsKey(organizationId, receiverId),
          });
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          log.debug("Realtime: Notifications subscription active", {
            channel: channelName,
          });
        } else if (status === "CHANNEL_ERROR") {
          log.warn("Realtime: Notifications subscription error", {
            channel: channelName,
            error: err?.message,
          });
        }
      });

    return () => {
      log.debug("Realtime: Cleaning up notifications subscription", {
        channel: channelName,
      });
      void supabase.removeChannel(channel);
    };
  }, [organizationId, receiverId, queryClient]);
}
