/**
 * Pure helpers for list-jobs worker scoping.
 */

export type ListJobsWorkerScopeInput = {
  mine?: boolean;
  workerId?: string | null;
  callerWorkerId?: string | null;
};

export type ListJobsWorkerScopeResult =
  | { ok: true; effectiveWorkerId: string | null }
  | { ok: false; status: 403; message: string };

/**
 * Decide which worker id (if any) should scope the job list.
 * - `mine: true` always uses the authenticated caller's worker id (ignores client worker_id).
 * - Explicit `worker_id` must match the caller's worker id (prevents IDOR).
 * - Neither → no worker scoping (dashboard org-wide list).
 */
export function resolveListJobsWorkerScope(
  input: ListJobsWorkerScopeInput
): ListJobsWorkerScopeResult {
  const { mine, workerId, callerWorkerId } = input;

  if (mine) {
    return { ok: true, effectiveWorkerId: callerWorkerId ?? null };
  }

  if (workerId) {
    if (!callerWorkerId || workerId !== callerWorkerId) {
      return {
        ok: false,
        status: 403,
        message: "You can only list jobs for your own worker profile",
      };
    }
    return { ok: true, effectiveWorkerId: workerId };
  }

  return { ok: true, effectiveWorkerId: null };
}

export function mergeParticipatingJobIds(
  jobWorkerJobIds: string[],
  submittedJobIds: string[]
): string[] {
  return [...new Set([...jobWorkerJobIds, ...submittedJobIds])];
}
