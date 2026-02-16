"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Hook to subscribe to real-time job changes.
 * Automatically invalidates the jobs React Query cache
 * when job records are inserted or updated.
 *
 * This enables real-time updates when:
 * - A worker submits a job from the mobile app (INSERT)
 * - A job is updated (e.g. approval status, completion)
 */
export function useRealtimeJobs(organizationId: string | null) {
  const queryClient = useQueryClient();

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

          // Refetch immediately (same pattern as useRealtimeWorkers)
          // queryKey prefix matches both includeTests true and false
          void queryClient.refetchQueries({
            queryKey: ["jobs", organizationId],
          });
        }
      )
      .subscribe((status, err) => {
        log.debug("useRealtimeJobs: Subscription status changed", {
          status,
          channel: channelName,
          error: err?.message,
        });
        if (status === "SUBSCRIBED") {
          log.info("Realtime: Jobs subscription active", {
            channel: channelName,
          });
        } else if (status === "CHANNEL_ERROR") {
          log.warn("Realtime: Jobs subscription error", {
            channel: channelName,
            error: err?.message,
          });
        }
      });

    return () => {
      log.debug("Realtime: Cleaning up jobs subscription", {
        channel: channelName,
      });
      void supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
