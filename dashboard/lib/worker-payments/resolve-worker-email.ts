/**
 * Resolve worker email for remittance sending.
 * S2 §4.3: First non-empty email from job workers matching workerId.
 */
import type { Job } from "@/lib/types";

export interface ResolvedWorkerEmail {
  email: string | null;
  source: "job_worker" | null;
  jobId: string | null;
}

/**
 * Resolves the email for a worker from the jobs array.
 * Per S2 §4.3:
 * - Find first non-empty email from job.workers where worker.id === workerId
 * - Treat empty string as missing
 * - If no email found, return null
 */
export function resolveWorkerEmail(workerId: string, jobs: Job[]): ResolvedWorkerEmail {
  for (const job of jobs) {
    if (!job.workers?.length) continue;
    const worker = job.workers.find((w) => w.id === workerId);
    if (worker?.email && worker.email.trim() !== "") {
      return {
        email: worker.email.trim(),
        source: "job_worker",
        jobId: job.id,
      };
    }
  }

  return {
    email: null,
    source: null,
    jobId: null,
  };
}

/**
 * Check if email looks valid (basic format check).
 */
export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
