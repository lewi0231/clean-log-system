import { endOfDay, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { isValidIanaTimeZone } from "@/lib/worker-payments/org-pay-period";

export type DatePreset = "week" | "fortnight" | "month";

/**
 * S2 calculate-ux: Default is local browser time. If `timeZone` is a valid IANA id, ranges are
 * computed in that zone (org pay period timezone).
 * This week = Monday (ISO) through end of today; fortnight = rolling 14d; month = first of month through end of today in that zone.
 */
export function getDatePresetRange(
  preset: DatePreset,
  now: Date = new Date(),
  timeZone?: string | null
): { from: Date; to: Date } {
  if (timeZone && isValidIanaTimeZone(timeZone)) {
    const z = toZonedTime(now, timeZone);
    const to = fromZonedTime(endOfDay(z), timeZone);
    if (preset === "week") {
      const wkStart = startOfWeek(z, { weekStartsOn: 1 });
      return {
        from: fromZonedTime(startOfDay(wkStart), timeZone),
        to,
      };
    }
    if (preset === "fortnight") {
      return {
        from: fromZonedTime(startOfDay(subDays(z, 13)), timeZone),
        to,
      };
    }
    return {
      from: fromZonedTime(startOfDay(startOfMonth(z)), timeZone),
      to,
    };
  }

  const to = endOfDay(now);
  if (preset === "week") {
    const wkStart = startOfWeek(now, { weekStartsOn: 1 });
    return { from: startOfDay(wkStart), to };
  }
  if (preset === "fortnight") {
    return { from: startOfDay(subDays(now, 13)), to };
  }
  return { from: startOfDay(startOfMonth(now)), to };
}

/** `yyyy-MM-dd` for `<input type="date">` in a zone (or browser local if `timeZone` is null/invalid). */
export function formatDateForRangeInput(d: Date, timeZone?: string | null): string {
  if (timeZone && isValidIanaTimeZone(timeZone)) {
    return formatInTimeZone(d, timeZone, "yyyy-MM-dd");
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive: job's completion instant falls within [from startOfDay, to endOfDay] in local time. */
export function isJobCompletedInLocalRange(completedAtIso: string, from: Date, to: Date): boolean {
  const t = new Date(completedAtIso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}
