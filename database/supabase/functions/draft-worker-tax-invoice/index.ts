import { serve } from "server";
import { extractAuthToken, getAuthUser, resolveOrganizationWorkerId } from "../_utils/auth.ts";
import {
  amountForWorkerFromCalculations,
  calculateAmountsForJobs,
} from "../calculate-worker-payment/handlers/calculate-amounts-for-jobs.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";
import {
  canSubmitTaxInvoice,
  normalizeWorkforceEngagement,
} from "../_utils/workforce-engagement.ts";
import {
  assertJobsEligibleForWorker,
  findActiveTaxInvoiceConflicts,
  normalizeTaxInvoiceJobIds,
} from "../_utils/worker-tax-invoice.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, { functionName: "draft-worker-tax-invoice" });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id", "job_ids"]);
    if (!v.valid) return errorResponse("organization_id and job_ids are required", 400);

    const organization_id = body.organization_id as string;
    const jobIdsNorm = normalizeTaxInvoiceJobIds(body.job_ids);
    if (!jobIdsNorm.ok) return errorResponse(jobIdsNorm.message, 400);
    const job_ids = jobIdsNorm.jobIds;

    const supabase = createServiceRoleClient();
    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) return orgGate.response;

    const token = extractAuthToken(req);
    const authUser = token ? await getAuthUser(token) : null;
    if (!authUser) return errorResponse("Authentication required", 401);

    const workerId = await resolveOrganizationWorkerId(
      supabase,
      organization_id,
      authUser.id,
      authUser.user_metadata as Record<string, unknown>
    );
    if (!workerId) return errorResponse("Worker record not found", 403);

    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("id, engagement_type, abn")
      .eq("id", workerId)
      .single();
    if (workerErr) throw workerErr;

    const { data: settings } = await supabase
      .from("organization_settings")
      .select("workforce_engagement")
      .eq("organization_id", organization_id)
      .maybeSingle();

    const orgEng = normalizeWorkforceEngagement(settings?.workforce_engagement);
    if (!canSubmitTaxInvoice(orgEng, worker?.engagement_type)) {
      return errorResponse("Tax invoices are not enabled for your account", 403);
    }

    const eligible = await assertJobsEligibleForWorker(
      supabase,
      organization_id,
      workerId,
      job_ids
    );
    if (!eligible.ok) return errorResponse(eligible.message, 400);

    const conflicts = await findActiveTaxInvoiceConflicts(supabase, workerId, eligible.jobIds);
    if (conflicts.length > 0) {
      return errorResponse("One or more jobs are already on an active tax invoice", 409);
    }

    const calcs = await calculateAmountsForJobs(supabase, organization_id, eligible.jobIds);
    const lines = amountForWorkerFromCalculations(calcs, workerId);
    if (lines.length === 0) {
      return errorResponse("No payable amounts for the selected jobs", 400);
    }

    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const { data: org } = await supabase
      .from("organization")
      .select("currency")
      .eq("id", organization_id)
      .maybeSingle();

    const { data: invoice, error: invErr } = await supabase
      .from("worker_tax_invoice")
      .insert({
        organization_id,
        worker_id: workerId,
        status: "draft",
        subtotal,
        total: subtotal,
        currency: org?.currency || "AUD",
        calculation_snapshot: { job_calculations: calcs, lines },
      })
      .select()
      .single();
    if (invErr) throw invErr;

    const { error: lineErr } = await supabase.from("worker_tax_invoice_line").insert(
      lines.map((l) => ({
        invoice_id: invoice.id,
        job_id: l.job_id,
        description: l.description,
        amount: l.amount,
      }))
    );
    if (lineErr) {
      await supabase.from("worker_tax_invoice").delete().eq("id", invoice.id);
      throw lineErr;
    }

    logger.info("Draft worker tax invoice created", { id: invoice.id, workerId });
    return jsonResponse({ success: true, invoice });
  } catch (e) {
    logger.error("draft-worker-tax-invoice", e);
    return errorResponse("Unexpected error", 500);
  }
});
