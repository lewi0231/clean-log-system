/**
 * Re-export shared workforce engagement helpers for Deno Edge Functions.
 */
export {
  WORKFORCE_ENGAGEMENT_VALUES,
  WORKER_ENGAGEMENT_TYPE_VALUES,
  WORKFORCE_ENGAGEMENT_DISCLAIMER,
  isWorkforceEngagement,
  isWorkerEngagementType,
  normalizeWorkforceEngagement,
  normalizeWorkerEngagementType,
  canSubmitTaxInvoice,
  canAdminSeeTaxInvoiceQueue,
  defaultWorkerEngagementForOrg,
  type WorkforceEngagement,
  type WorkerEngagementType,
} from "../../../shared/utils/workforce-engagement.ts";
