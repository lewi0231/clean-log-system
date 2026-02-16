"use client";

import { useRealtimeJobs } from "@/hooks/use-realtime-jobs";
import { useRealtimeWorkers } from "@/hooks/use-realtime-workers";
import useOrganization from "@/hooks/useOrganization";

/**
 * Mounts realtime subscriptions at the dashboard layout level.
 * This ensures subscriptions are active on every dashboard page, so:
 * - Worker list updates when a worker activates (e.g. via invitation link)
 * - Completed jobs list updates when a job is submitted (mobile app) or updated
 *
 * Without this, subscriptions would only run when the relevant page is mounted.
 * Notifications are already covered by NotificationBell (in Nav).
 */
export function RealtimeSubscriptions() {
  const { organizationId } = useOrganization();

  useRealtimeWorkers(organizationId);
  useRealtimeJobs(organizationId);

  return null;
}
