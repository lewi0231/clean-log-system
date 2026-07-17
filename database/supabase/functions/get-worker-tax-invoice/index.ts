import { serve } from "server";
import { extractAuthToken, getAuthUser, resolveOrganizationWorkerId } from "../_utils/auth.ts";
import { isActiveOrgStaff } from "../_utils/org-sending-domain-edge.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, { functionName: "get-worker-tax-invoice" });
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

    const { data: invoice, error } = await supabase
      .from("worker_tax_invoice")
      .select(
        "*, worker:worker_id(id, first_name, last_name, name, abn), lines:worker_tax_invoice_line(*)"
      )
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return errorResponse("Invoice not found", 404);

    const staff = await isActiveOrgStaff(supabase, organization_id, authUser.id);
    if (!staff) {
      const workerId = await resolveOrganizationWorkerId(
        supabase,
        organization_id,
        authUser.id,
        authUser.user_metadata as Record<string, unknown>
      );
      if (invoice.worker_id !== workerId) {
        return errorResponse("Invoice not found", 404);
      }
    }

    return jsonResponse({ success: true, invoice });
  } catch (e) {
    logger.error("get-worker-tax-invoice", e);
    return errorResponse(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
