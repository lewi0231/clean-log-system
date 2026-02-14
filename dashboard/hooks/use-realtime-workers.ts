"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { workersLocationsKey } from "@/app/query-provider";
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
 */
export function useRealtimeWorkers(organizationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const channelName = `workers:${organizationId}`;

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
          log.debug("Realtime: Worker change received", {
            event: payload.eventType,
            organizationId,
          });

          // Invalidate the React Query cache to trigger a refetch
          void queryClient.invalidateQueries({
            queryKey: workersLocationsKey(organizationId),
          });
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          log.debug("Realtime: Workers subscription active", {
            channel: channelName,
          });
        } else if (status === "CHANNEL_ERROR") {
          log.warn("Realtime: Workers subscription error", {
            channel: channelName,
            error: err?.message,
          });
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
