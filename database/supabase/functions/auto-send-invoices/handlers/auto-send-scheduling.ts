import type { AutoSendConfig } from "./types.ts";

/**
 * Check if auto-send should run based on configuration and current time
 */
export function shouldRunAutoSend(config: AutoSendConfig, now: Date): boolean {
  if (!config.enabled) return false;

  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  if (config.time) {
    const [configHour, configMinute] = config.time.split(":").map(Number);
    if (hour !== configHour || minute !== configMinute) {
      return false;
    }
  }

  switch (config.period) {
    case "daily":
      return true;
    case "weekly":
      return config.day_of_week !== undefined && dayOfWeek === config.day_of_week;
    case "monthly":
      return config.day_of_month !== undefined && dayOfMonth === config.day_of_month;
    default:
      return false;
  }
}

/** Auto-send config from location hierarchy metadata */
export function getAutoSendConfig(metadata: Record<string, unknown> | null): AutoSendConfig | null {
  if (!metadata || typeof metadata !== "object") return null;

  const autoSend = metadata.auto_send_invoices;
  if (!autoSend || typeof autoSend !== "object") return null;

  const config = autoSend as Record<string, unknown>;
  if (config.enabled !== true) return null;

  return {
    enabled: true,
    period: (config.period as "daily" | "weekly" | "monthly") || "daily",
    day_of_week: config.day_of_week !== undefined ? Number(config.day_of_week) : undefined,
    day_of_month: config.day_of_month !== undefined ? Number(config.day_of_month) : undefined,
    time: (config.time as string) || "09:00",
  };
}

/** Organization-level auto-send from organization_settings JSON */
export function getOrgAutoSendConfig(configJson: unknown): AutoSendConfig | null {
  if (!configJson || typeof configJson !== "object") return null;

  const config = configJson as Record<string, unknown>;
  if (config.enabled !== true) return null;

  return {
    enabled: true,
    period: (config.period as "daily" | "weekly" | "monthly") || "daily",
    day_of_week: config.day_of_week !== undefined ? Number(config.day_of_week) : undefined,
    day_of_month: config.day_of_month !== undefined ? Number(config.day_of_month) : undefined,
    time: (config.time as string) || "09:00",
  };
}
