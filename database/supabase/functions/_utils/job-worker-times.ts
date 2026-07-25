/**
 * Resolve per-worker clock times for job_worker.start_time / end_time.
 *
 * Mobile stores clocks in submission_data:
 * - Per-worker: worker_times[{ worker_id, start_time, finish_time }]
 * - Shared: start_time + finish_time (applied to every worker)
 *
 * job_worker uses end_time (not finish_time).
 */

export type JobWorkerTimeRange = {
  start_time: string;
  end_time: string;
};

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function readSharedTimeRange(submissionData: Record<string, unknown>): JobWorkerTimeRange | null {
  const start = submissionData.start_time;
  const finish = submissionData.finish_time ?? submissionData.end_time;
  if (!isValidTimestamp(start) || !isValidTimestamp(finish)) return null;
  return { start_time: start, end_time: finish };
}

function readWorkerTimesArray(
  submissionData: Record<string, unknown>
): Map<string, JobWorkerTimeRange> {
  const map = new Map<string, JobWorkerTimeRange>();
  const raw = submissionData.worker_times;
  if (!Array.isArray(raw)) return map;

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const workerId = row.worker_id;
    if (typeof workerId !== "string" || workerId.trim() === "") continue;

    const start = row.start_time;
    const finish = row.finish_time ?? row.end_time;
    if (!isValidTimestamp(start) || !isValidTimestamp(finish)) continue;

    map.set(workerId, { start_time: start, end_time: finish });
  }

  return map;
}

/** Hours between two ISO timestamps (≥ 0). Invalid dates or end≤start → 0. */
export function hoursFromTimeRange(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return hours > 0 ? hours : 0;
}

/** True when both timestamps parse and end is strictly after start. */
export function isPositiveTimeRange(startTime: string, endTime: string): boolean {
  return hoursFromTimeRange(startTime, endTime) > 0;
}

function acceptRange(range: JobWorkerTimeRange | null): JobWorkerTimeRange | null {
  if (!range) return null;
  // Reject zero/negative duration so one bad clock does not force mixed-hours
  // weights-only splits for the whole crew (S1 §2.2).
  return isPositiveTimeRange(range.start_time, range.end_time) ? range : null;
}

/**
 * Resolve start/end for one worker from submission_data.
 * Prefers per-worker worker_times, then shared start/finish.
 * Returns null when times are missing or end ≤ start.
 */
export function resolveWorkerTimeRange(
  workerId: string,
  submissionData: Record<string, unknown> | null | undefined
): JobWorkerTimeRange | null {
  if (!submissionData || typeof submissionData !== "object") return null;

  const perWorker = readWorkerTimesArray(submissionData).get(workerId);
  if (perWorker) return acceptRange(perWorker);

  return acceptRange(readSharedTimeRange(submissionData));
}

/**
 * Attach start_time / end_time to job_worker insert rows from submission_data.
 */
export function withJobWorkerTimes<T extends { worker_id: string }>(
  entries: T[],
  submissionData: Record<string, unknown> | null | undefined
): Array<T & { start_time: string | null; end_time: string | null }> {
  return entries.map((entry) => {
    const range = resolveWorkerTimeRange(entry.worker_id, submissionData);
    return {
      ...entry,
      start_time: range?.start_time ?? null,
      end_time: range?.end_time ?? null,
    };
  });
}
