"use client";

import { useEffect, useRef } from "react";
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
 * Subscribe to real-time worker changes and refetch the workers-locations cache.
 * Matches jobs realtime (refetchQueries) and notifications (CHANNEL_ERROR debounce).
 */
export function useRealtimeWorkers(organizationId: string | null) {
  const queryClient = useQueryClient();
  const lastChannelErrorWarnAtRef = useRef(0);

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

    let debouncedRefetch: ReturnType<typeof setTimeout> | null = null;

    const refetchWorkers = () => {
      void queryClient.refetchQueries({
        queryKey: workersLocationsKey(organizationId),
      });
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
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
          refetchWorkers();
        }
      )
      .subscribe((status, err) => {
        logRealtimeSubscribeStatus("workers", channelName, status, err);
        if (status === "SUBSCRIBED") {
          log.debug("Realtime: workers channel subscribed", { channel: channelName });
        } else if (status === "CHANNEL_ERROR") {
          const now = Date.now();
          if (now - lastChannelErrorWarnAtRef.current > 20_000) {
            lastChannelErrorWarnAtRef.current = now;
            log.warn("Realtime: workers CHANNEL_ERROR (WebSocket/channel issue)", {
              channel: channelName,
              errorSerialized: err != null ? String(err) : "undefined",
              hint: "Debounced refetch scheduled. Enable NEXT_PUBLIC_DEBUG_REALTIME=true for details.",
            });
          }
          if (isRealtimeDebugEnabled()) {
            log.warn("Realtime: workers raw err", { err });
          }
          if (debouncedRefetch) clearTimeout(debouncedRefetch);
          debouncedRefetch = setTimeout(() => {
            debouncedRefetch = null;
            refetchWorkers();
          }, 1500);
        } else {
          log.debug("Realtime: workers channel status", { status, channel: channelName });
        }
      });

    return () => {
      if (debouncedRefetch) clearTimeout(debouncedRefetch);
      log.debug("Realtime: Cleaning up workers subscription", {
        channel: channelName,
      });
      void supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
