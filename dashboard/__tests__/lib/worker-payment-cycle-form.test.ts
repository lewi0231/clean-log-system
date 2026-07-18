import {
  buildWorkerPaymentCycleConfig,
  freqFromValue,
  workerPaymentCycleConfigsEqual,
} from "@/lib/worker-payment-cycle-form";
import { describe, expect, it } from "vitest";

describe("worker-payment-cycle-form", () => {
  it("freqFromValue maps known frequencies and defaults to none", () => {
    expect(freqFromValue(null)).toBe("none");
    expect(freqFromValue({ payment_frequency: "weekly" } as never)).toBe("weekly");
    expect(freqFromValue({ payment_frequency: "fortnightly" } as never)).toBe("fortnightly");
    expect(freqFromValue({ payment_frequency: "monthly" } as never)).toBe("monthly");
  });

  it("buildWorkerPaymentCycleConfig returns null for none", () => {
    expect(
      buildWorkerPaymentCycleConfig({
        frequency: "none",
        tzIana: "Australia/Adelaide",
        paymentDayOfWeek: "1",
        paymentDayOfMonth: "15",
        cutOffTime: "17:00",
        requireApproval: false,
        autoCalculate: false,
      })
    ).toBeNull();
  });

  it("buildWorkerPaymentCycleConfig clamps day-of-week and falls back invalid day-of-month", () => {
    const cfg = buildWorkerPaymentCycleConfig({
      frequency: "monthly",
      tzIana: " Australia/Sydney ",
      paymentDayOfWeek: "99",
      paymentDayOfMonth: "0", // falsy after parse → default 15, then clamp
      cutOffTime: " 09:30 ",
      requireApproval: true,
      autoCalculate: true,
    });
    expect(cfg).toMatchObject({
      payment_frequency: "monthly",
      payment_day_of_week: 7,
      payment_day_of_month: 15,
      cut_off_time: "09:30",
      timezone: "Australia/Sydney",
      require_approval: true,
      auto_calculate: true,
    });
  });

  it("workerPaymentCycleConfigsEqual treats nulls and equivalent configs", () => {
    expect(workerPaymentCycleConfigsEqual(null, null)).toBe(true);
    expect(workerPaymentCycleConfigsEqual(null, { payment_frequency: "weekly" } as never)).toBe(
      false
    );
    const a = buildWorkerPaymentCycleConfig({
      frequency: "weekly",
      tzIana: "UTC",
      paymentDayOfWeek: "1",
      paymentDayOfMonth: "",
      cutOffTime: "17:00",
      requireApproval: false,
      autoCalculate: false,
    });
    const b = { ...a!, cut_off_time: "17:00", timezone: "UTC" };
    expect(workerPaymentCycleConfigsEqual(a, b)).toBe(true);
    expect(workerPaymentCycleConfigsEqual(a, { ...b, payment_day_of_week: 2 })).toBe(false);
  });
});
