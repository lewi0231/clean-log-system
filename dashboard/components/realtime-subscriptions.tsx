"use client";

import { useRealtimeWorkers } from "@/hooks/use-realtime-workers";
import useOrganization from "@/hooks/useOrganization";

/**
 * Mounts realtime worker subscription at the dashboard layout level.
 * This ensures the workers subscription is active on every dashboard page, so:
 * - Worker list updates immediately when a worker activates (e.g. via invitation link)
 *
 * Without this, the subscription would only run when a page that uses useWorkers is mounted.
 * Pages like Settings, Help, or Mobile Config don't use useWorkers, so workers would not
 * update in realtime. Notifications are already covered by NotificationBell (in Nav).
 */
export function RealtimeSubscriptions() {
  const { organizationId } = useOrganization();

  useRealtimeWorkers(organizationId);

  return null;
}
