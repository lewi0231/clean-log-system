import type { CalculateWorkerPaymentsResponse } from "@/lib/services/worker-payment.service";
import type { Job } from "@/lib/types";
import { reconcileBatchTotal } from "./export-batch-worker-csv";

export interface WorkerPreviewRow {
  workerId: string;
  name: string;
  total: number;
  /** Aligns with `splitModeFromRow` / rolled-up `mixed` when worker has jobs with different split paths. */
  splitMode: string;
  hoursWorked: number;
  jobIds: string[];
  /**
   * Display of rate-card pool weights (hours × weight drives the pool). Empty when not applicable (e.g. equal split only).
   */
  weightLabel: string;
}

type WorkerAgg = {
  name: string;
  total: number;
  hours: number;
  jobIds: Set<string>;
  modes: Set<string>;
  /** Distinct pool weights from time-based splits (rate card). */
  weights: Set<number>;
};

function findWorkerName(job: Job, workerId: string): string {
  return job.workers.find((w) => w.id === workerId)?.name ?? workerId;
}

function addWorker(
  map: Map<string, WorkerAgg>,
  workerId: string,
  part: {
    name: string;
    addAmount: number;
    addHours: number;
    jobId: string;
    mode: string;
    poolWeight: number | null;
  }
): void {
  const existing = map.get(workerId);
  if (existing) {
    existing.total += part.addAmount;
    existing.hours += part.addHours;
    existing.jobIds.add(part.jobId);
    existing.modes.add(part.mode);
    if (part.poolWeight != null && Number.isFinite(part.poolWeight)) {
      existing.weights.add(part.poolWeight);
    }
  } else {
    const w = new Set<number>();
    if (part.poolWeight != null && Number.isFinite(part.poolWeight)) {
      w.add(part.poolWeight);
    }
    map.set(workerId, {
      name: part.name,
      total: part.addAmount,
      hours: part.addHours,
      jobIds: new Set([part.jobId]),
      modes: new Set([part.mode]),
      weights: w,
    });
  }
}

/** Formats distinct pool weights for the by-worker table (e.g. "1.0", "0.6 · 1.0"). */
export function formatWeightLabel(modes: Set<string>, weights: Set<number>): string {
  const hasTime = modes.has("time_based");
  if (!hasTime || weights.size === 0) return "—";
  const sorted = [...weights].sort((a, b) => a - b);
  return sorted.map((n) => (Number.isInteger(n) ? String(n) : n.toFixed(1))).join(" · ");
}

/**
 * Per-worker roll-up for preview (in-memory). Mirrors `save-worker-payment`: use `worker_splits` when
 * present, else equal split of `total_worker_payment` across `job.workers`.
 */
export function buildWorkerPreviewRowsFromCalculation(
  response: CalculateWorkerPaymentsResponse,
  jobs: Job[]
): WorkerPreviewRow[] {
  const { job_calculations } = response.calculation;
  const byWorker = new Map<string, WorkerAgg>();

  for (const jc of job_calculations) {
    const job = jobs.find((j) => j.id === jc.job_id);
    if (!job) continue;

    if (jc.worker_splits && jc.worker_splits.length > 0) {
      for (const split of jc.worker_splits) {
        const name = split.worker_name?.trim() || findWorkerName(job, split.worker_id);
        const poolWeight =
          split.split_weight != null && Number.isFinite(split.split_weight)
            ? split.split_weight
            : 1.0;
        addWorker(byWorker, split.worker_id, {
          name,
          addAmount: split.final_payment,
          addHours: Number.isFinite(split.hours_worked) ? split.hours_worked : 0,
          jobId: jc.job_id,
          mode: "time_based",
          poolWeight,
        });
      }
    } else {
      const workerIds = job.workers.map((w) => w.id);
      if (workerIds.length === 0) continue;
      const per = jc.total_worker_payment / workerIds.length;
      for (const wid of workerIds) {
        addWorker(byWorker, wid, {
          name: findWorkerName(job, wid),
          addAmount: per,
          addHours: 0,
          jobId: jc.job_id,
          mode: "equal_split_fallback",
          poolWeight: null,
        });
      }
    }
  }

  const rows: WorkerPreviewRow[] = [];
  for (const [workerId, v] of byWorker) {
    const splitMode = v.modes.size === 1 ? [...v.modes][0]! : "mixed";
    rows.push({
      workerId,
      name: v.name,
      total: v.total,
      splitMode,
      hoursWorked: v.hours,
      jobIds: [...v.jobIds],
      weightLabel: formatWeightLabel(v.modes, v.weights),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return rows;
}

/** One line per (worker, job) for drill-down in preview UI. */
export interface WorkerJobPreviewLine {
  jobId: string;
  amount: number;
  mode: string;
  hours: number;
}

export function getWorkerJobPreviewLines(
  response: CalculateWorkerPaymentsResponse,
  jobs: Job[],
  workerId: string
): WorkerJobPreviewLine[] {
  const lines: WorkerJobPreviewLine[] = [];
  for (const jc of response.calculation.job_calculations) {
    const job = jobs.find((j) => j.id === jc.job_id);
    if (!job) continue;

    if (jc.worker_splits && jc.worker_splits.length > 0) {
      const split = jc.worker_splits.find((s) => s.worker_id === workerId);
      if (split) {
        lines.push({
          jobId: jc.job_id,
          amount: split.final_payment,
          mode: "time_based",
          hours: Number.isFinite(split.hours_worked) ? split.hours_worked : 0,
        });
      }
    } else {
      const hasWorker = job.workers.some((w) => w.id === workerId);
      if (!hasWorker) continue;
      const n = job.workers.length;
      if (n === 0) continue;
      lines.push({
        jobId: jc.job_id,
        amount: jc.total_worker_payment / n,
        mode: "equal_split_fallback",
        hours: 0,
      });
    }
  }
  return lines;
}

/**
 * Assert preview worker rows sum to batch total (same story as `save-worker_payment` + reconciliation).
 * Uses org currency for minor units when provided; defaults to 2-decimal.
 */
/** Share of a job or run total as a percentage string (e.g. for preview tables). */
export function formatDollarSharePercent(part: number, total: number): string {
  if (total <= 0 || !Number.isFinite(part) || !Number.isFinite(total)) {
    return "—";
  }
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function labelForSplitMode(mode: string): string {
  switch (mode) {
    case "time_based":
      return "Time-based";
    case "equal_split_fallback":
      return "Equal split";
    case "mixed":
      return "Mixed";
    case "calculated":
      return "Calculated";
    default:
      return mode;
  }
}

export function verifyWorkerPreviewReconciliation(
  rows: WorkerPreviewRow[],
  totalWorkerPayment: number,
  currency: string
): { ok: boolean; deltaMinorUnits: number } {
  const r = reconcileBatchTotal(
    totalWorkerPayment,
    rows.map((row) => ({ amount: row.total })),
    currency
  );
  return { ok: r.ok, deltaMinorUnits: r.deltaMinorUnits };
}
