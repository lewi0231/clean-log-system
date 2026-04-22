"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { workersLocationsKey } from "@/app/query-provider";
import {
  isRealtimeDebugEnabled,
  logRealtimeDebug,
  logRealtimePayload,
  logRealtimeSubscribeStatus,
} from "@/lib/realtime-debug";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Hook to subscribe to real-time worker changes.
 * Automatically invalidates the workers-locations React Query cache
 * when worker records are inserted, updated, or deleted.
 *
 * This enables real-time updates when:
 * - A worker accepts an invitation (status → active)
 * - A worker is created or deleted
 * - Worker details are modified
 *
 * If you see CHANNEL_ERROR in the console, the Realtime WebSocket may be dropping
 * (dev HMR, network, or Supabase limits). Workers list also refetches on window focus
 * and tab visibility (see useWorkersAndLocations). Set NEXT_PUBLIC_DEBUG_REALTIME=true
 * for verbose payload logging.
 */
export function useRealtimeWorkers(organizationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) {
      log.debug("useRealtimeWorkers: skipping - no organizationId");
      return;
    }

    const channelName = `workers:${organizationId}`;
    log.debug("useRealtimeWorkers: subscribing", {
      channelName,
      organizationId,
    });
    logRealtimeDebug("workers", "subscribing", { channelName, organizationId });

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "worker",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          log.debug("Realtime: worker row changed", {
            event: payload.eventType,
            organizationId,
          });
          logRealtimePayload("workers", channelName, {
            eventType: payload.eventType,
            table: payload.table ?? "worker",
            new: payload.new,
            old: payload.old,
          });

          void queryClient.invalidateQueries({
            queryKey: workersLocationsKey(organizationId),
            refetchType: "active",
          });
        }
      )
      .subscribe((status, err) => {
        logRealtimeSubscribeStatus("workers", channelName, status, err);
        if (status === "SUBSCRIBED") {
          log.debug("Realtime: workers channel subscribed", { channel: channelName });
        } else if (status === "CHANNEL_ERROR") {
          log.warn("Realtime: workers CHANNEL_ERROR (WebSocket/channel issue)", {
            channel: channelName,
            errorSerialized: err != null ? String(err) : "undefined",
            hint: "List may still refresh on window focus. Enable NEXT_PUBLIC_DEBUG_REALTIME=true for details.",
          });
          if (isRealtimeDebugEnabled()) {
            log.warn("Realtime: workers raw err", { err });
          }
        } else {
          log.debug("Realtime: workers channel status", { status, channel: channelName });
        }
      });

    return () => {
      log.debug("Realtime: Cleaning up workers subscription", {
        channel: channelName,
      });
      void supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
