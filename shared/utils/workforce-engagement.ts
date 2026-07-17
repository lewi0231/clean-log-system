/**
 * Workforce engagement helpers for contractor tax-invoice gating.
 * Canonical implementation — Deno re-exports via functions/_utils/workforce-engagement.ts
 */

export const WORKFORCE_ENGAGEMENT_VALUES = ["employees", "contractors", "both"] as const;
export type WorkforceEngagement = (typeof WORKFORCE_ENGAGEMENT_VALUES)[number];

export const WORKER_ENGAGEMENT_TYPE_VALUES = ["employee", "contractor"] as const;
export type WorkerEngagementType = (typeof WORKER_ENGAGEMENT_TYPE_VALUES)[number];

export const WORKFORCE_ENGAGEMENT_DISCLAIMER =
  "This setting controls how worker settlement works in Tally Runner. It does not determine employment status for tax, superannuation, or Fair Work purposes. Seek your own advice.";

export function isWorkforceEngagement(value: unknown): value is WorkforceEngagement {
  return (
    typeof value === "string" &&
    (WORKFORCE_ENGAGEMENT_VALUES as readonly string[]).includes(value)
  );
}

export function isWorkerEngagementType(value: unknown): value is WorkerEngagementType {
  return (
    typeof value === "string" &&
    (WORKER_ENGAGEMENT_TYPE_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeWorkforceEngagement(value: unknown): WorkforceEngagement {
  return isWorkforceEngagement(value) ? value : "employees";
}

export function normalizeWorkerEngagementType(value: unknown): WorkerEngagementType {
  return isWorkerEngagementType(value) ? value : "employee";
}

/** Mobile / worker: may submit a tax invoice */
export function canSubmitTaxInvoice(
  orgEngagement: WorkforceEngagement | string | null | undefined,
  workerEngagement: WorkerEngagementType | string | null | undefined,
): boolean {
  const org = normalizeWorkforceEngagement(orgEngagement);
  const worker = normalizeWorkerEngagementType(workerEngagement);
  if (org === "employees") return false;
  if (org === "contractors") return true;
  return worker === "contractor";
}

/** Admin dashboard: show Tax invoices queue */
export function canAdminSeeTaxInvoiceQueue(
  orgEngagement: WorkforceEngagement | string | null | undefined,
  hasHistoricalTaxInvoices = false,
): boolean {
  const org = normalizeWorkforceEngagement(orgEngagement);
  if (org === "contractors" || org === "both") return true;
  return hasHistoricalTaxInvoices;
}

/** Default engagement_type when creating a worker */
export function defaultWorkerEngagementForOrg(
  orgEngagement: WorkforceEngagement,
): WorkerEngagementType | null {
  if (orgEngagement === "employees") return "employee";
  if (orgEngagement === "contractors") return "contractor";
  return null; // both — must be explicit
}
