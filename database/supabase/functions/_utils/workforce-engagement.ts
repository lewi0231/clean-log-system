/**
 * Workforce engagement helpers for Deno Edge Functions.
 * Keep in sync with shared/utils/workforce-engagement.ts
 * (Edge runtime cannot import files outside database/supabase/functions/).
 */

export const WORKFORCE_ENGAGEMENT_VALUES = ["employees", "contractors", "both"] as const;
export type WorkforceEngagement = (typeof WORKFORCE_ENGAGEMENT_VALUES)[number];

export const WORKER_ENGAGEMENT_TYPE_VALUES = ["employee", "contractor"] as const;
export type WorkerEngagementType = (typeof WORKER_ENGAGEMENT_TYPE_VALUES)[number];

export const WORKFORCE_ENGAGEMENT_DISCLAIMER =
  "This setting controls how worker settlement works in Tally Runner. It does not determine employment status for tax, superannuation, or Fair Work purposes. Seek your own advice.";

export function isWorkforceEngagement(value: unknown): value is WorkforceEngagement {
  return (
    typeof value === "string" && (WORKFORCE_ENGAGEMENT_VALUES as readonly string[]).includes(value)
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

export function canSubmitTaxInvoice(
  orgEngagement: WorkforceEngagement | string | null | undefined,
  workerEngagement: WorkerEngagementType | string | null | undefined
): boolean {
  const org = normalizeWorkforceEngagement(orgEngagement);
  const worker = normalizeWorkerEngagementType(workerEngagement);
  if (org === "employees") return false;
  if (org === "contractors") return true;
  return worker === "contractor";
}

export function canAdminSeeTaxInvoiceQueue(
  orgEngagement: WorkforceEngagement | string | null | undefined,
  hasHistoricalTaxInvoices = false
): boolean {
  const org = normalizeWorkforceEngagement(orgEngagement);
  if (org === "contractors" || org === "both") return true;
  return hasHistoricalTaxInvoices;
}

export function defaultWorkerEngagementForOrg(
  orgEngagement: WorkforceEngagement
): WorkerEngagementType | null {
  if (orgEngagement === "employees") return "employee";
  if (orgEngagement === "contractors") return "contractor";
  return null;
}
