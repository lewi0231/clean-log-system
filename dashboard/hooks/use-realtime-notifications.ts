"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { notificationsKey, workersLocationsKey } from "@/app/query-provider";
import {
  isRealtimeDebugEnabled,
  logRealtimePayload,
  logRealtimeSubscribeStatus,
} from "@/lib/realtime-debug";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Hook to subscribe to real-time notification changes.
 * Automatically invalidates the notifications React Query cache
 * when notifications are inserted or updated.
 *
 * CHANNEL_ERROR with undefined `err` usually indicates the Realtime WebSocket closed
 * (reconnect storms in dev, network blips). Notifications still refetch on focus.
 * Set NEXT_PUBLIC_DEBUG_REALTIME=true for verbose subscribe logs.
 */
export function useRealtimeNotifications(organizationId: string | null, receiverId: string | null) {
  const queryClient = useQueryClient();
  /** Throttle noisy CHANNEL_ERROR warnings (reconnect storms). */
  const lastChannelErrorWarnAtRef = useRef(0);

  useEffect(() => {
    if (!organizationId || !receiverId) {
      log.debug("useRealtimeNotifications: skipping (need org + receiver)", {
        organizationId,
        receiverId,
      });
      return;
    }

    const channelName = `notifications:${receiverId}`;
    log.debug("useRealtimeNotifications: subscribing", {
      channelName,
      organizationId,
      receiverId,
    });

    let debouncedInvalidate: ReturnType<typeof setTimeout> | null = null;

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
          log.debug("Realtime: notification row changed", {
            event: payload.eventType,
            receiverId,
          });
          logRealtimePayload("notifications", channelName, {
            eventType: payload.eventType,
            table: payload.table ?? "notification",
            new: payload.new,
            old: payload.old,
          });

          void queryClient.invalidateQueries({
            queryKey: notificationsKey(organizationId, receiverId),
            refetchType: "active",
          });

          const row = payload.new as { type?: string } | null | undefined;
          const t = row?.type;
          if (payload.eventType === "INSERT" && (t === "worker_active" || t === "worker_created")) {
            void queryClient.invalidateQueries({
              queryKey: workersLocationsKey(organizationId),
              refetchType: "active",
            });
          }
        }
      )
      .subscribe((status, err) => {
        logRealtimeSubscribeStatus("notifications", channelName, status, err);
        if (status === "SUBSCRIBED") {
          log.debug("Realtime: notifications channel subscribed", {
            channel: channelName,
          });
        } else if (status === "CHANNEL_ERROR") {
          const now = Date.now();
          if (now - lastChannelErrorWarnAtRef.current > 20_000) {
            lastChannelErrorWarnAtRef.current = now;
            log.warn("Realtime: notifications CHANNEL_ERROR (WebSocket/channel issue)", {
              channel: channelName,
              errorSerialized: err != null ? String(err) : "undefined",
              hint: "Refetch on focus still updates the bell. Enable NEXT_PUBLIC_DEBUG_REALTIME=true for verbose logs.",
            });
          } else {
            log.debug("Realtime: notifications CHANNEL_ERROR (suppressed repeat)", {
              channel: channelName,
            });
          }
          if (isRealtimeDebugEnabled()) {
            log.warn("Realtime: notifications raw err", { err });
          }
          // Realtime dropped: poll notifications once (debounced) so the inbox stays fresh.
          if (debouncedInvalidate) clearTimeout(debouncedInvalidate);
          debouncedInvalidate = setTimeout(() => {
            debouncedInvalidate = null;
            void queryClient.invalidateQueries({
              queryKey: notificationsKey(organizationId, receiverId),
              refetchType: "active",
            });
          }, 1500);
        } else {
          log.debug("Realtime: notifications channel status", {
            status,
            channel: channelName,
          });
        }
      });

    return () => {
      if (debouncedInvalidate) clearTimeout(debouncedInvalidate);
      log.debug("Realtime: Cleaning up notifications subscription", {
        channel: channelName,
      });
      void supabase.removeChannel(channel);
    };
  }, [organizationId, receiverId, queryClient]);
}
