"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  isRealtimeDebugEnabled,
  logRealtimeDebug,
  logRealtimePayload,
  logRealtimeSubscribeStatus,
} from "@/lib/realtime-debug";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to real-time job changes and refetch the jobs cache.
 * Matches workers realtime: CHANNEL_ERROR debounced refetch + debug helpers.
 *
 * Enables updates when:
 * - A worker submits a job from the mobile app (INSERT)
 * - A job is updated (e.g. approval status, completion)
 */
export function useRealtimeJobs(organizationId: string | null) {
  const queryClient = useQueryClient();
  const lastChannelErrorWarnAtRef = useRef(0);

  useEffect(() => {
    if (!organizationId) {
      log.debug("useRealtimeJobs: Skipping - no organizationId");
      return;
    }

    const channelName = `jobs:${organizationId}`;
    log.debug("useRealtimeJobs: Setting up subscription", {
      channelName,
      organizationId,
    });
    logRealtimeDebug("jobs", "subscribing", { channelName, organizationId });

    let debouncedRefetch: ReturnType<typeof setTimeout> | null = null;

    const refetchJobs = () => {
      // queryKey prefix matches both includeTests true and false
      void queryClient.refetchQueries({
        queryKey: ["jobs", organizationId],
      });
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;
          log.info("Realtime: Job change received", {
            event: payload.eventType,
            organizationId,
            jobId: newRecord?.id ?? oldRecord?.id,
          });
          logRealtimePayload("jobs", channelName, {
            eventType: payload.eventType,
            table: payload.table ?? "job",
            new: payload.new,
            old: payload.old,
          });
          refetchJobs();
        }
      )
      .subscribe((status, err) => {
        logRealtimeSubscribeStatus("jobs", channelName, status, err);
        if (status === "SUBSCRIBED") {
          log.info("Realtime: Jobs subscription active", {
            channel: channelName,
          });
        } else if (status === "CHANNEL_ERROR") {
          const now = Date.now();
          if (now - lastChannelErrorWarnAtRef.current > 20_000) {
            lastChannelErrorWarnAtRef.current = now;
            log.warn("Realtime: Jobs CHANNEL_ERROR (WebSocket/channel issue)", {
              channel: channelName,
              errorSerialized: err != null ? String(err) : "undefined",
              hint: "Debounced refetch scheduled. Focus/reconnect also refreshes the jobs list. Enable NEXT_PUBLIC_DEBUG_REALTIME=true for details.",
            });
          }
          if (isRealtimeDebugEnabled()) {
            log.warn("Realtime: jobs raw err", { err });
          }
          if (debouncedRefetch) clearTimeout(debouncedRefetch);
          debouncedRefetch = setTimeout(() => {
            debouncedRefetch = null;
            refetchJobs();
          }, 1500);
        } else {
          log.debug("Realtime: jobs channel status", { status, channel: channelName });
        }
      });

    return () => {
      if (debouncedRefetch) clearTimeout(debouncedRefetch);
      log.debug("Realtime: Cleaning up jobs subscription", {
        channel: channelName,
      });
      void supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
