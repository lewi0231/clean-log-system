export type SubmissionSummaryEntry =
  | { kind: "field"; label: string; value: string }
  | { kind: "grouped_breakdown"; label: string; items: Array<{ brand: string; quantity: number }> }
  | {
      kind: "worker_times";
      label: string;
      items: Array<{ workerLabel: string; start: string; finish: string }>;
    };

export type SubmissionSummaryOptions = {
  /** Map worker_id → display name for worker_times rows */
  workerNameById?: Record<string, string>;
};

type GroupedBreakdownItem = { brand: string; quantity: number };

type WorkerTimeItem = {
  worker_id?: string;
  start_time?: string;
  finish_time?: string;
};

function isGroupedBreakdownArray(value: unknown[]): value is GroupedBreakdownItem[] {
  return value.every(
    (item) => typeof item === "object" && item !== null && "brand" in item && "quantity" in item
  );
}

function isWorkerTimesArray(value: unknown[]): value is WorkerTimeItem[] {
  // Empty arrays are not worker_times payloads — keep shared start/finish visible.
  if (value.length === 0) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const row = item as Record<string, unknown>;
    return "worker_id" in row || "start_time" in row || "finish_time" in row;
  });
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDateTimeValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // HH:mm local — enough for same-day job times; include date if not today
  const time = `${parsed.getHours().toString().padStart(2, "0")}:${parsed
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const today = new Date();
  const sameDay =
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate();
  if (sameDay) return time;
  return `${parsed.toLocaleDateString()} ${time}`;
}

function formatLeaf(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // ISO timestamps (start_time / finish_time)
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateTimeValue(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatLeaf(v)).join(", ");
  }
  return JSON.stringify(value);
}

/**
 * Build a flat list of display entries from raw submission_data.
 * Shared by mobile screens and unit tests.
 */
export function buildSubmissionSummaryEntries(
  data: Record<string, unknown> | null | undefined,
  options: SubmissionSummaryOptions = {}
): SubmissionSummaryEntry[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const entries: SubmissionSummaryEntry[] = [];
  const hasWorkerTimes =
    Array.isArray(data.worker_times) && isWorkerTimesArray(data.worker_times as unknown[]);

  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      // When per-worker times exist, skip shared start/finish to avoid a misleading single pair.
      if (hasWorkerTimes && (key === "start_time" || key === "finish_time") && !prefix) {
        continue;
      }

      const label = prefix ? `${prefix} › ${humanizeKey(key)}` : humanizeKey(key);

      if (value === null || value === undefined) {
        entries.push({ kind: "field", label, value: "—" });
        continue;
      }

      if (key === "worker_times" && Array.isArray(value) && isWorkerTimesArray(value)) {
        entries.push({
          kind: "worker_times",
          label: "Work times",
          items: value.map((item, index) => {
            const id = typeof item.worker_id === "string" ? item.worker_id : "";
            const workerLabel =
              (id && options.workerNameById?.[id]) ||
              (id ? `Worker ${id.slice(0, 8)}` : `Worker ${index + 1}`);
            return {
              workerLabel,
              start: item.start_time ? formatDateTimeValue(item.start_time) : "—",
              finish: item.finish_time ? formatDateTimeValue(item.finish_time) : "—",
            };
          }),
        });
        continue;
      }

      if (Array.isArray(value) && isGroupedBreakdownArray(value)) {
        entries.push({ kind: "grouped_breakdown", label, items: value });
        continue;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, label);
        continue;
      }

      entries.push({ kind: "field", label, value: formatLeaf(value) });
    }
  };

  walk(data);
  return entries;
}
