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
} from "../_utils/worker-tax-invoice.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, { functionName: "submit-worker-tax-invoice" });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id", "invoice_id"]);
    if (!v.valid) return errorResponse("organization_id and invoice_id are required", 400);

    const organization_id = body.organization_id as string;
    const invoice_id = body.invoice_id as string;
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
      .select("id, abn, engagement_type")
      .eq("id", workerId)
      .single();
    if (workerErr) throw workerErr;
    if (!worker?.abn?.trim()) {
      return errorResponse("ABN is required before submitting a tax invoice", 400);
    }

    const { data: settings } = await supabase
      .from("organization_settings")
      .select("workforce_engagement")
      .eq("organization_id", organization_id)
      .maybeSingle();
    const orgEng = normalizeWorkforceEngagement(settings?.workforce_engagement);
    if (!canSubmitTaxInvoice(orgEng, worker.engagement_type)) {
      return errorResponse("Tax invoices are not enabled for your account", 403);
    }

    const { data: invoice, error: invErr } = await supabase
      .from("worker_tax_invoice")
      .select("id, worker_id, status, organization_id")
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invoice || invoice.worker_id !== workerId) {
      return errorResponse("Invoice not found", 404);
    }
    if (invoice.status !== "draft") {
      return errorResponse("Only draft invoices can be submitted", 400);
    }

    const { data: lines, error: linesErr } = await supabase
      .from("worker_tax_invoice_line")
      .select("job_id")
      .eq("invoice_id", invoice_id);
    if (linesErr) throw linesErr;
    const job_ids = (lines || []).map((l) => l.job_id);

    const eligible = await assertJobsEligibleForWorker(
      supabase,
      organization_id,
      workerId,
      job_ids
    );
    if (!eligible.ok) return errorResponse(eligible.message, 400);

    const conflicts = await findActiveTaxInvoiceConflicts(
      supabase,
      workerId,
      eligible.jobIds,
      invoice_id
    );
    if (conflicts.length > 0) {
      return errorResponse("Job conflict with another active tax invoice", 409);
    }

    const calcs = await calculateAmountsForJobs(supabase, organization_id, eligible.jobIds);
    const newLines = amountForWorkerFromCalculations(calcs, workerId);
    const total = newLines.reduce((s, l) => s + l.amount, 0);
    if (total <= 0) {
      return errorResponse("Tax invoice total must be greater than zero", 400);
    }
    if (newLines.length === 0) {
      return errorResponse("No payable amounts for the selected jobs", 400);
    }

    const { data: numberRows, error: numErr } = await supabase.rpc(
      "generate_worker_tax_invoice_number",
      { p_organization_id: organization_id }
    );
    if (numErr) throw numErr;
    const invoice_number = numberRows as unknown as string;

    const { error: delErr } = await supabase
      .from("worker_tax_invoice_line")
      .delete()
      .eq("invoice_id", invoice_id);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from("worker_tax_invoice_line").insert(
      newLines.map((l) => ({
        invoice_id,
        job_id: l.job_id,
        description: l.description,
        amount: l.amount,
      }))
    );
    if (insErr) {
      logger.error("submit line insert failed after delete", insErr);
      throw new Error("Failed to update tax invoice lines");
    }

    // Optimistic lock: only transition draft → submitted once
    const { data: updated, error: updErr } = await supabase
      .from("worker_tax_invoice")
      .update({
        status: "submitted",
        invoice_number,
        subtotal: total,
        total,
        calculation_snapshot: { job_calculations: calcs, lines: newLines },
        submitted_at: new Date().toISOString(),
        issued_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice_id)
      .eq("status", "draft")
      .select()
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updated) {
      return errorResponse("Invoice was already submitted or changed", 409);
    }

    logger.info("Worker tax invoice submitted", { invoice_id, invoice_number });
    return jsonResponse({ success: true, invoice: updated });
  } catch (e) {
    logger.error("submit-worker-tax-invoice", e);
    return errorResponse("Unexpected error", 500);
  }
});
