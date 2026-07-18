import { serve } from "server";
import { requireOrgAdminFromRequest } from "../_utils/org-sending-domain-edge.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, { functionName: "review-worker-tax-invoice" });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id", "invoice_id", "action"]);
    if (!v.valid) {
      return errorResponse("organization_id, invoice_id, and action are required", 400);
    }

    const organization_id = body.organization_id as string;
    const invoice_id = body.invoice_id as string;
    const action = body.action as string;
    const review_notes = typeof body.review_notes === "string" ? body.review_notes : null;

    if (action !== "approve" && action !== "reject") {
      return errorResponse("action must be approve or reject", 400);
    }

    const supabase = createServiceRoleClient();
    const gate = await requireOrgAdminFromRequest(req, organization_id, supabase, body);
    if (!gate.ok) return errorResponse(gate.message, gate.status);

    const { data: invoice, error } = await supabase
      .from("worker_tax_invoice")
      .select("id, status")
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return errorResponse("Invoice not found", 404);
    if (invoice.status !== "submitted") {
      return errorResponse("Only submitted invoices can be reviewed", 400);
    }

    const nextStatus = action === "approve" ? "approved" : "rejected";
    const { data: updated, error: updErr } = await supabase
      .from("worker_tax_invoice")
      .update({
        status: nextStatus,
        review_notes,
        approved_at: action === "approve" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice_id)
      .eq("status", "submitted")
      .select()
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updated) {
      return errorResponse("Invoice was already reviewed or changed", 409);
    }

    logger.info("Worker tax invoice reviewed", { invoice_id, action });
    return jsonResponse({ success: true, invoice: updated });
  } catch (e) {
    logger.error("review-worker-tax-invoice", e);
    return errorResponse("Unexpected error", 500);
  }
});
