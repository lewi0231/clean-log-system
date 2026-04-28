import {
  buildWorkerPreviewRowsFromCalculation,
  formatDollarSharePercent,
  formatWeightLabel,
  getWorkerJobPreviewLines,
  labelForSplitMode,
  verifyWorkerPreviewReconciliation,
} from "@/lib/worker-payments/build-worker-preview";
import type { CalculateWorkerPaymentsResponse } from "@/lib/services/worker-payment.service";
import type { Job } from "@/lib/types";
import { describe, expect, it } from "vitest";

function workerRow(id: string, name: string): Job["workers"][0] {
  return {
    id,
    name,
    email: "",
    phone: null,
    confirmation_status: "confirmed",
    confirmed_at: null,
    flagged_at: null,
    flag_reason: null,
  };
}

const baseJob = (id: string, workerIds: string[], names: string[]): Job =>
  ({
    id,
    organization_id: "o1",
    location_id: "l1",
    submission_data: null,
    completed_at: "2024-01-15T10:00:00.000Z",
    created_at: "2024-01-01T00:00:00.000Z",
    location: {
      id: "l1",
      name: "Loc",
      email: "e@x.com",
      address: null,
      contact_person: null,
      phone: null,
    },
    workers: workerIds.map((wid, i) => workerRow(wid, names[i] ?? wid)),
  }) as Job;

describe("formatDollarSharePercent", () => {
  it("returns percent of total", () => {
    expect(formatDollarSharePercent(25, 100)).toBe("25.0%");
    expect(formatDollarSharePercent(1, 3)).toBe("33.3%");
  });
  it("returns em dash for invalid total", () => {
    expect(formatDollarSharePercent(1, 0)).toBe("—");
  });
});

describe("formatWeightLabel", () => {
  it("formats distinct weights sorted", () => {
    expect(formatWeightLabel(new Set(["time_based"]), new Set([1, 0.6]))).toBe("0.6 · 1");
  });
  it("returns em dash when not time-based", () => {
    expect(formatWeightLabel(new Set(["equal_split_fallback"]), new Set([1]))).toBe("—");
  });
});

describe("buildWorkerPreviewRowsFromCalculation", () => {
  it("time_based splits: sums workers and reconciles to batch total", () => {
    const calc: CalculateWorkerPaymentsResponse = {
      success: true,
      calculation: {
        total_worker_payment: 300,
        job_calculations: [
          {
            job_id: "j1",
            line_items: [],
            applied_rules: [],
            subtotal: 300,
            total_adjustments: 0,
            total_worker_payment: 300,
            worker_splits: [
              {
                worker_id: "w1",
                worker_name: "A",
                hours_worked: 8,
                time_share: 0.5,
                multiplier_adjustment: 0,
                per_unit_bonus: 0,
                flat_bonus: 0,
                team_percentage_bonus: 0,
                final_payment: 200,
                allocation_type: "time",
                split_weight: 1.0,
              },
              {
                worker_id: "w2",
                worker_name: "B",
                hours_worked: 8,
                time_share: 0.5,
                multiplier_adjustment: 0,
                per_unit_bonus: 0,
                flat_bonus: 0,
                team_percentage_bonus: 0,
                final_payment: 100,
                allocation_type: "time",
                split_weight: 0.6,
              },
            ],
          },
        ],
      },
    };
    const jobs: Job[] = [baseJob("j1", ["w1", "w2"], ["A", "B"])];

    const rows = buildWorkerPreviewRowsFromCalculation(calc, jobs);
    expect(rows).toHaveLength(2);
    const w1 = rows.find((r) => r.workerId === "w1");
    const w2 = rows.find((r) => r.workerId === "w2");
    expect(w1?.weightLabel).toBe("1");
    expect(w2?.weightLabel).toBe("0.6");
    const t = rows.reduce((s, r) => s + r.total, 0);
    expect(t).toBe(300);
    const r0 = verifyWorkerPreviewReconciliation(rows, 300, "AUD");
    expect(r0.ok).toBe(true);
  });

  it("equal split when no worker_splits: splits total across job.workers", () => {
    const calc: CalculateWorkerPaymentsResponse = {
      success: true,
      calculation: {
        total_worker_payment: 100,
        job_calculations: [
          {
            job_id: "j1",
            line_items: [],
            applied_rules: [],
            subtotal: 100,
            total_adjustments: 0,
            total_worker_payment: 100,
          },
        ],
      },
    };
    const jobs: Job[] = [baseJob("j1", ["w1", "w2"], ["A", "B"])];

    const rows = buildWorkerPreviewRowsFromCalculation(calc, jobs);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.splitMode === "equal_split_fallback")).toBe(true);
    expect(rows.every((r) => r.weightLabel === "—")).toBe(true);
    expect(rows[0]!.total).toBe(50);
    expect(rows[1]!.total).toBe(50);
    const r0 = verifyWorkerPreviewReconciliation(rows, 100, "AUD");
    expect(r0.ok).toBe(true);
  });

  it("mixed: different modes for same worker across jobs", () => {
    const calc: CalculateWorkerPaymentsResponse = {
      success: true,
      calculation: {
        total_worker_payment: 150,
        job_calculations: [
          {
            job_id: "j1",
            line_items: [],
            applied_rules: [],
            subtotal: 100,
            total_adjustments: 0,
            total_worker_payment: 100,
            worker_splits: [
              {
                worker_id: "w1",
                worker_name: "A",
                hours_worked: 4,
                time_share: 1,
                multiplier_adjustment: 0,
                per_unit_bonus: 0,
                flat_bonus: 0,
                team_percentage_bonus: 0,
                final_payment: 100,
                allocation_type: "time",
              },
            ],
          },
          {
            job_id: "j2",
            line_items: [],
            applied_rules: [],
            subtotal: 50,
            total_adjustments: 0,
            total_worker_payment: 50,
          },
        ],
      },
    };
    const jobs: Job[] = [baseJob("j1", ["w1"], ["A"]), baseJob("j2", ["w1", "w2"], ["A", "B"])];

    const rows = buildWorkerPreviewRowsFromCalculation(calc, jobs);
    const w1 = rows.find((r) => r.workerId === "w1");
    expect(w1?.splitMode).toBe("mixed");
    expect(w1?.total).toBe(125);
  });

  it("getWorkerJobPreviewLines returns per-job lines for a worker", () => {
    const calc: CalculateWorkerPaymentsResponse = {
      success: true,
      calculation: {
        total_worker_payment: 100,
        job_calculations: [
          {
            job_id: "j1",
            line_items: [],
            applied_rules: [],
            subtotal: 100,
            total_adjustments: 0,
            total_worker_payment: 100,
          },
        ],
      },
    };
    const jobs: Job[] = [baseJob("j1", ["w1", "w2"], ["A", "B"])];

    const lines = getWorkerJobPreviewLines(calc, jobs, "w1");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe(50);
  });
});

describe("labelForSplitMode", () => {
  it("maps known keys", () => {
    expect(labelForSplitMode("time_based")).toBe("Time-based");
    expect(labelForSplitMode("equal_split_fallback")).toBe("Equal split");
  });
});
