import {
  getCurrentPayPeriodRange,
  formatPayPeriodBannerLine,
  isoWeekdayToWeekStartsOn,
  isValidIanaTimeZone,
} from "@/lib/worker-payments/org-pay-period";
import { describe, expect, it } from "vitest";

describe("org-pay-period", () => {
  it("isValidIanaTimeZone accepts Australia/Adelaide and rejects invalid", () => {
    expect(isValidIanaTimeZone("Australia/Adelaide")).toBe(true);
    expect(isValidIanaTimeZone("Not/A_Zone_12345")).toBe(false);
  });

  it("isoWeekdayToWeekStartsOn maps ISO 1–7 to date-fns weekStartsOn", () => {
    expect(isoWeekdayToWeekStartsOn(1)).toBe(1);
    expect(isoWeekdayToWeekStartsOn(7)).toBe(0);
  });

  it("fallback: null config uses calendar month in browser TZ", () => {
    const now = new Date("2026-04-15T12:00:00.000Z");
    const r = getCurrentPayPeriodRange(null, {
      now,
      browserTimeZone: "UTC",
    });
    expect(r.mode).toBe("fallback");
    expect(r.timeZone).toBe("UTC");
    expect(r.from.getTime()).toBeLessThan(r.to.getTime());
  });

  it("monthly configured uses org timezone", () => {
    const now = new Date("2026-04-15T12:00:00.000Z");
    const r = getCurrentPayPeriodRange(
      {
        payment_frequency: "monthly",
        timezone: "UTC",
        payment_day_of_month: 15,
      },
      { now, browserTimeZone: "America/New_York" }
    );
    expect(r.mode).toBe("configured");
    expect(r.timeZone).toBe("UTC");
  });

  it("formatPayPeriodBannerLine includes range and kind", () => {
    const { line, mode } = formatPayPeriodBannerLine(
      { payment_frequency: "weekly", timezone: "UTC" },
      { now: new Date("2026-04-15T12:00:00.000Z"), browserTimeZone: "UTC" }
    );
    expect(mode).toBe("configured");
    expect(line).toContain("Week");
    expect(line).toContain("(");
  });
});
