import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { WorkerPaymentCycleConfig } from "@/lib/types";

/** ISO weekday 1 = Monday … 7 = Sunday → date-fns `weekStartsOn` (0 = Sunday). */
export function isoWeekdayToWeekStartsOn(iso: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (iso === 7) return 0;
  if (iso >= 1 && iso <= 6) return iso as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return 1;
}

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string" || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(config: WorkerPaymentCycleConfig | null, browserTimeZone: string): string {
  const t = config?.timezone?.trim();
  if (t && isValidIanaTimeZone(t)) return t;
  return browserTimeZone;
}

/**
 * Current pay period in the effective timezone.
 * If `config` is null or `payment_frequency` is null/invalid → calendar month in `browserTimeZone` (S2 fallback).
 */
export function getCurrentPayPeriodRange(
  config: WorkerPaymentCycleConfig | null,
  options?: { now?: Date; browserTimeZone?: string }
): {
  from: Date;
  to: Date;
  label: string;
  mode: "configured" | "fallback";
  timeZone: string;
} {
  const now = options?.now ?? new Date();
  const browserTimeZone =
    options?.browserTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = resolveTimeZone(config, browserTimeZone);
  const frequency = config?.payment_frequency;

  if (!frequency || !["weekly", "fortnightly", "monthly"].includes(frequency)) {
    return { ...monthlyRange(now, tz, "fallback"), timeZone: tz };
  }

  const weekStartsOn = isoWeekdayToWeekStartsOn(
    config?.payment_day_of_week != null &&
      config.payment_day_of_week >= 1 &&
      config.payment_day_of_week <= 7
      ? config.payment_day_of_week
      : 1
  );

  if (frequency === "weekly") {
    const z = toZonedTime(now, tz);
    const wkStart = startOfWeek(z, { weekStartsOn });
    const wkEnd = endOfWeek(z, { weekStartsOn });
    const from = fromZonedTime(startOfDay(wkStart), tz);
    const to = fromZonedTime(endOfDay(wkEnd), tz);
    return {
      from,
      to,
      label: formatPeriodLabel(from, to, tz),
      mode: "configured",
      timeZone: tz,
    };
  }

  if (frequency === "fortnightly") {
    const z = toZonedTime(now, tz);
    const fromLocal = startOfDay(subDays(z, 13));
    const from = fromZonedTime(fromLocal, tz);
    const to = fromZonedTime(endOfDay(z), tz);
    return {
      from,
      to,
      label: formatPeriodLabel(from, to, tz),
      mode: "configured",
      timeZone: tz,
    };
  }

  return { ...monthlyRange(now, tz, "configured"), timeZone: tz };
}

function monthlyRange(
  now: Date,
  tz: string,
  mode: "configured" | "fallback"
): { from: Date; to: Date; label: string; mode: "configured" | "fallback" } {
  const z = toZonedTime(now, tz);
  const ms = startOfMonth(z);
  const me = endOfMonth(z);
  const from = fromZonedTime(startOfDay(ms), tz);
  const to = fromZonedTime(endOfDay(me), tz);
  return {
    from,
    to,
    label: formatPeriodLabel(from, to, tz),
    mode,
  };
}

const FREQ_BANNER: Record<string, string> = {
  weekly: "Week",
  fortnightly: "Fortnight",
  monthly: "Month",
};

/**
 * S2 §5.2: "Apr 1 – Apr 30, 2026 (Month)" style line for Overview.
 */
export function formatPayPeriodBannerLine(
  config: WorkerPaymentCycleConfig | null,
  options?: { now?: Date; browserTimeZone?: string }
): { line: string; mode: "configured" | "fallback" } {
  const r = getCurrentPayPeriodRange(config, options);
  const kind =
    r.mode === "fallback" || !config?.payment_frequency
      ? "Month"
      : (FREQ_BANNER[config.payment_frequency] ?? "Month");
  const range = formatShortCalendarRange(r.from, r.to, r.timeZone);
  return { line: `${range} (${kind})`, mode: r.mode };
}

/** Calendar date range in a zone, e.g. for Summary section headings. */
export function formatShortCalendarRange(from: Date, to: Date, timeZone: string): string {
  const y1 = formatInTimeZone(from, timeZone, "yyyy");
  const y2 = formatInTimeZone(to, timeZone, "yyyy");
  const m1 = formatInTimeZone(from, timeZone, "MMM");
  const m2 = formatInTimeZone(to, timeZone, "MMM");
  if (y1 === y2 && m1 === m2) {
    return `${m1} ${formatInTimeZone(from, timeZone, "d")} – ${formatInTimeZone(
      to,
      timeZone,
      "d, yyyy"
    )}`;
  }
  if (y1 === y2) {
    return `${formatInTimeZone(from, timeZone, "MMM d")} – ${formatInTimeZone(
      to,
      timeZone,
      "MMM d, yyyy"
    )}`;
  }
  return `${formatInTimeZone(from, timeZone, "MMM d, yyyy")} – ${formatInTimeZone(
    to,
    timeZone,
    "MMM d, yyyy"
  )}`;
}

function formatPeriodLabel(from: Date, to: Date, timeZone: string): string {
  const start = formatInTimeZone(from, timeZone, "EEE MMM d");
  const end = formatInTimeZone(to, timeZone, "EEE MMM d, yyyy");
  return `${start} – ${end}`;
}
