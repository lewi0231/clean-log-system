import type { WorkerPaymentCycleConfig } from "@/lib/types";

export type PayFrequencyChoice = "none" | "weekly" | "fortnightly" | "monthly";

export function freqFromValue(value: WorkerPaymentCycleConfig | null): PayFrequencyChoice {
  const f = value?.payment_frequency;
  if (f === "weekly" || f === "fortnightly" || f === "monthly") return f;
  return "none";
}

export function buildWorkerPaymentCycleConfig(input: {
  frequency: PayFrequencyChoice;
  tzIana: string;
  paymentDayOfWeek: string;
  paymentDayOfMonth: string;
  cutOffTime: string;
  requireApproval: boolean;
  autoCalculate: boolean;
}): WorkerPaymentCycleConfig | null {
  if (input.frequency === "none") return null;

  const tzRaw = input.tzIana.trim();
  const dom =
    input.paymentDayOfMonth.trim() === ""
      ? null
      : Math.min(31, Math.max(1, parseInt(input.paymentDayOfMonth, 10) || 15));
  const dow = Math.min(7, Math.max(1, parseInt(input.paymentDayOfWeek, 10) || 1));

  return {
    payment_frequency: input.frequency,
    payment_day_of_week: dow,
    payment_day_of_month: dom,
    cut_off_time: input.cutOffTime.trim() || null,
    timezone: tzRaw || null,
    require_approval: input.requireApproval,
    auto_calculate: input.autoCalculate,
  };
}

/** Stable compare for autosave skip (ignores key order). */
export function workerPaymentCycleConfigsEqual(
  a: WorkerPaymentCycleConfig | null,
  b: WorkerPaymentCycleConfig | null
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  return (
    a.payment_frequency === b.payment_frequency &&
    a.payment_day_of_week === b.payment_day_of_week &&
    a.payment_day_of_month === b.payment_day_of_month &&
    (a.cut_off_time ?? null) === (b.cut_off_time ?? null) &&
    (a.timezone ?? null) === (b.timezone ?? null) &&
    Boolean(a.require_approval) === Boolean(b.require_approval) &&
    Boolean(a.auto_calculate) === Boolean(b.auto_calculate)
  );
}
