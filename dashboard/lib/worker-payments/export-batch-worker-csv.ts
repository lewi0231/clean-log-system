/**
 * Pure worker-payment batch → CSV (no React).
 * S3 §2.2 (reconciliation), S2 §6.2 (columns / header comments).
 */

export interface BatchWorkerPaymentRow {
  id: string;
  job_id: string;
  worker_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  calculation_details: unknown;
  notes: string | null;
  created_at: string;
}

/** ISO-4217 minor units: 0 = JPY, KRW, etc.; 2 = most; default 2 if unknown. */
const MINOR_UNITS: Record<string, number> = {
  AUD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  NZD: 2,
  CAD: 2,
  JPY: 0,
  KRW: 0,
  VND: 0,
};

export function getCurrencyMinorUnitFactor(currency: string): number {
  const c = currency.trim().toUpperCase();
  const d = MINOR_UNITS[c] ?? 2;
  return 10 ** d;
}

/**
 * T = batch total, S = sum of per-line amounts.
 * Compare in "minor" integer units; pass if |T−S| ≤ 1 minor unit of that currency.
 */
export function reconcileBatchTotal(
  total: number,
  lineAmounts: { amount: number }[],
  currency: string
): { ok: boolean; deltaMinorUnits: number; currencyMinorUnitFactor: number } {
  const factor = getCurrencyMinorUnitFactor(currency);
  const tMinor = Math.round(total * factor);
  const sMinor = lineAmounts.reduce((acc, row) => acc + Math.round(row.amount * factor), 0);
  const deltaMinorUnits = tMinor - sMinor;
  return {
    ok: Math.abs(deltaMinorUnits) <= 1,
    deltaMinorUnits,
    currencyMinorUnitFactor: factor,
  };
}

export interface RollupEntry {
  workerId: string;
  total: number;
  jobIds: Set<string>;
  hoursWorked: number;
  /** Combined split label when multiple line modes exist. */
  splitMode: string;
}

/** Post-save: derive split label from `worker_payment.calculation_details` (same strings as preview). */
export function splitModeFromRow(calculationDetails: unknown): string {
  if (!calculationDetails || typeof calculationDetails !== "object") return "calculated";
  const d = calculationDetails as {
    worker_split?: unknown;
    split_among_workers?: number;
  };
  if (d.worker_split) return "time_based";
  if (d.split_among_workers != null) return "equal_split_fallback";
  return "calculated";
}

function hoursFromRow(calculationDetails: unknown): number {
  if (!calculationDetails || typeof calculationDetails !== "object") return 0;
  const d = calculationDetails as { worker_split?: { hours_worked?: number } };
  const h = d.worker_split?.hours_worked;
  return typeof h === "number" && !Number.isNaN(h) ? h : 0;
}

/** Pool share weight from saved worker_payment (time-based path). */
export function poolWeightFromCalculationDetails(calculationDetails: unknown): number | null {
  if (!calculationDetails || typeof calculationDetails !== "object") return null;
  const w = (calculationDetails as { worker_split?: { split_weight?: number } }).worker_split
    ?.split_weight;
  return typeof w === "number" && Number.isFinite(w) ? w : null;
}

/** Clock hours for this line when time-based. */
export function hoursFromCalculationDetails(calculationDetails: unknown): number | null {
  if (splitModeFromRow(calculationDetails) !== "time_based") return null;
  if (!calculationDetails || typeof calculationDetails !== "object") return null;
  const d = calculationDetails as { worker_split?: { hours_worked?: number } };
  const h = d.worker_split?.hours_worked;
  if (typeof h !== "number" || Number.isNaN(h)) return null;
  return h;
}

/**
 * One row per worker: sums amounts and hours; merges split_mode when mixed → "mixed".
 */
export function rollupByWorkerId(rows: BatchWorkerPaymentRow[]): Map<string, RollupEntry> {
  const map = new Map<string, RollupEntry>();

  for (const r of rows) {
    const mode = splitModeFromRow(r.calculation_details);
    const h = hoursFromRow(r.calculation_details);
    const existing = map.get(r.worker_id);
    if (existing) {
      existing.total += r.amount;
      existing.jobIds.add(r.job_id);
      existing.hoursWorked += h;
      if (existing.splitMode !== mode) existing.splitMode = "mixed";
    } else {
      map.set(r.worker_id, {
        workerId: r.worker_id,
        total: r.amount,
        jobIds: new Set([r.job_id]),
        hoursWorked: h,
        splitMode: mode,
      });
    }
  }

  return map;
}

/** RFC 4180-style: quote if comma, quote, crlf, or formula-injection start. */
export function escapeCsvField(value: string): string {
  const needsQuote =
    /[",\r\n]/.test(value) || /^[=+\-@]/.test(value.trimStart()) || value.includes('"');
  if (!needsQuote) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

export interface WorkerTotalsCsvRow {
  batch_id: string;
  organization_id: string;
  currency: string;
  worker_id: string;
  worker_name: string;
  total_for_batch: string;
  job_count_in_batch: string;
  hours_worked: string;
  split_mode: string;
  calculated_at: string;
  export_generated_at: string;
}

const HEADER: (keyof WorkerTotalsCsvRow)[] = [
  "batch_id",
  "organization_id",
  "currency",
  "worker_id",
  "worker_name",
  "total_for_batch",
  "job_count_in_batch",
  "hours_worked",
  "split_mode",
  "calculated_at",
  "export_generated_at",
];

const DISCLAIMER =
  "DISCLAIMER: Amounts are estimates for informational purposes only. Verify totals with your payroll system. Tally Runner does not transfer funds, file tax returns, or provide legal/financial advice. For AU: see fairwork.gov.au; for other jurisdictions: consult local authorities.";

export function buildWorkerTotalsCsv(options: {
  batchId: string;
  organizationId: string;
  currency: string;
  calculatedAt: string;
  exportGeneratedAt: string;
  dataRows: WorkerTotalsCsvRow[];
  /** T_batch and S_workers after roll-up, for final comment line. */
  reconciliation: { tBatch: number; sWorkers: number; ok: boolean };
}): string {
  const {
    batchId,
    organizationId: _organizationId,
    currency: _currency,
    calculatedAt,
    exportGeneratedAt: _exportGeneratedAt,
    dataRows,
    reconciliation,
  } = options;
  const lines: string[] = [
    "# Tally Runner Worker Payment Export",
    `# Batch: ${batchId} | Calculated: ${calculatedAt}`,
    `# ${DISCLAIMER}`,
    HEADER.join(","),
    ...dataRows.map((row) => HEADER.map((k) => escapeCsvField(String(row[k] ?? ""))).join(",")),
    `# RECONCILIATION: T_batch=${reconciliation.tBatch} S_workers=${reconciliation.sWorkers} ${reconciliation.ok ? "OK" : "MISMATCH"}`,
  ];
  return lines.join("\r\n");
}
