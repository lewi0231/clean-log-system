import { serve } from "server";
import { extractAuthToken, getAuthUser, resolveOrganizationWorkerId } from "../_utils/auth.ts";
import { isActiveOrgAdmin, requireOrgAdminFromRequest } from "../_utils/org-sending-domain-edge.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";
import { canCancelTaxInvoiceStatus } from "../_utils/worker-tax-invoice.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, {
    functionName: "update-worker-tax-invoice-status",
  });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id", "invoice_id"]);
    if (!v.valid) {
      return errorResponse("organization_id and invoice_id are required", 400);
    }

    const organization_id = body.organization_id as string;
    const invoice_id = body.invoice_id as string;
    const action = typeof body.action === "string" ? body.action : null;
    const statusRaw = typeof body.status === "string" ? body.status : null;
    let status: string;
    if (action === "cancel" || statusRaw === "cancelled") {
      status = "cancelled";
    } else if (action === "mark_paid" || statusRaw === "paid") {
      status = "paid";
    } else {
      return errorResponse("action must be cancel or mark_paid", 400);
    }

    const supabase = createServiceRoleClient();
    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) return orgGate.response;

    const token = extractAuthToken(req);
    const authUser = token ? await getAuthUser(token) : null;
    if (!authUser) return errorResponse("Authentication required", 401);

    const { data: invoice, error } = await supabase
      .from("worker_tax_invoice")
      .select("id, worker_id, status")
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return errorResponse("Invoice not found", 404);

    const admin = await isActiveOrgAdmin(supabase, organization_id, authUser.id);

    if (status === "cancelled") {
      if (!canCancelTaxInvoiceStatus(invoice.status)) {
        return errorResponse("Only draft, submitted, or approved invoices can be cancelled", 400);
      }
      if (invoice.status === "draft") {
        const workerId = await resolveOrganizationWorkerId(
          supabase,
          organization_id,
          authUser.id,
          authUser.user_metadata as Record<string, unknown>
        );
        if (!admin && invoice.worker_id !== workerId) {
          return errorResponse("Forbidden", 403);
        }
      } else if (!admin) {
        return errorResponse("Admin access required to cancel this invoice", 403);
      }
    } else if (status === "paid") {
      const gate = await requireOrgAdminFromRequest(req, organization_id, supabase, body);
      if (!gate.ok) return errorResponse(gate.message, gate.status);
      if (invoice.status !== "approved") {
        return errorResponse("Only approved invoices can be marked paid", 400);
      }
    }

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "paid") {
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data: updated, error: updErr } = await supabase
      .from("worker_tax_invoice")
      .update(updatePayload)
      .eq("id", invoice_id)
      .eq("status", invoice.status) // optimistic lock on expected prior status
      .select()
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updated) {
      return errorResponse("Invoice status changed concurrently", 409);
    }

    logger.info("Worker tax invoice status updated", { invoice_id, status });
    return jsonResponse({ success: true, invoice: updated });
  } catch (e) {
    logger.error("update-worker-tax-invoice-status", e);
    return errorResponse("Unexpected error", 500);
  }
});
