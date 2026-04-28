import { getDatePresetRange, isJobCompletedInLocalRange } from "@/lib/worker-payments/date-presets";
import { describe, expect, it, vi, afterEach } from "vitest";

describe("getDatePresetRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("week: Monday through end of that Sunday (mock Wed)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00")); // Wed
    const { from, to } = getDatePresetRange("week");
    // weekStartsOn: 1 => Monday 2026-04-13
    expect(from.getDate()).toBe(13);
    expect(from.getMonth()).toBe(3); // April
    expect(to.getDate()).toBe(15);
  });

  it("fortnight: 14 days ending today (mock Wed Apr 15)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00"));
    const { from, to } = getDatePresetRange("fortnight");
    expect(from.getDate()).toBe(2);
    expect(from.getMonth()).toBe(3);
    expect(to.getDate()).toBe(15);
  });

  it("month: first of month through today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00"));
    const { from, to } = getDatePresetRange("month");
    expect(from.getDate()).toBe(1);
    expect(to.getDate()).toBe(15);
  });
});

describe("isJobCompletedInLocalRange", () => {
  it("return true for instant inside range", () => {
    const from = new Date("2026-04-10T00:00:00");
    const to = new Date("2026-04-20T23:59:59.999");
    expect(isJobCompletedInLocalRange("2026-04-15T10:00:00.000Z", from, to)).toBe(true);
  });
});
