/**
 * Opt-in verbose logging for Supabase Realtime (subscribe status, payloads, connection errors).
 * Set NEXT_PUBLIC_DEBUG_REALTIME=true in .env.development to enable.
 */
import { log } from "@/lib/logger";

export function isRealtimeDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_REALTIME === "true";
}

function serializeError(err: unknown): string {
  if (err == null) return "undefined";
  if (err instanceof Error) {
    return `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function logRealtimeDebug(
  scope: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isRealtimeDebugEnabled()) return;
  log.info(`[RealtimeDebug:${scope}] ${message}`, data);
}

export function logRealtimeSubscribeStatus(
  scope: string,
  channelName: string,
  status: string,
  err?: unknown
): void {
  if (!isRealtimeDebugEnabled()) {
    return;
  }
  log.info(`[RealtimeDebug:${scope}] subscribe callback`, {
    channelName,
    status,
    errorDetail: serializeError(err),
  });
}

export function logRealtimePayload(
  scope: string,
  channelName: string,
  payload: {
    eventType?: string;
    table?: string;
    new?: unknown;
    old?: unknown;
  }
): void {
  if (!isRealtimeDebugEnabled()) return;
  const n = payload.new;
  const safe: Record<string, unknown> = {
    eventType: payload.eventType,
    table: payload.table,
  };
  if (n && typeof n === "object") {
    const r = n as Record<string, unknown>;
    for (const k of ["id", "active", "type", "receiver_id", "organization_id"]) {
      if (k in r) safe[k] = r[k];
    }
  }
  log.info(`[RealtimeDebug:${scope}] postgres_changes`, {
    channelName,
    ...safe,
  });
}
