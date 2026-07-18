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
  const logger = createLogger(req, { functionName: "list-worker-tax-invoices" });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id"]);
    if (!v.valid) return errorResponse("organization_id is required", 400);
    const organization_id = body.organization_id as string;

    const supabase = createServiceRoleClient();
    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) return orgGate.response;

    const token = extractAuthToken(req);
    const authUser = token ? await getAuthUser(token) : null;
    if (!authUser) return errorResponse("Authentication required", 401);

    const staff = await isActiveOrgStaff(supabase, organization_id, authUser.id);
    let query = supabase
      .from("worker_tax_invoice")
      .select(
        "id, organization_id, worker_id, invoice_number, status, subtotal, total, currency, submitted_at, created_at, worker:worker_id(id, first_name, last_name, name)"
      )
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    if (!staff) {
      const workerId = await resolveOrganizationWorkerId(
        supabase,
        organization_id,
        authUser.id,
        authUser.user_metadata as Record<string, unknown>
      );
      if (!workerId) return errorResponse("Worker record not found", 403);
      query = query.eq("worker_id", workerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return jsonResponse({ success: true, invoices: data || [] });
  } catch (e) {
    logger.error("list-worker-tax-invoices", e);
    return errorResponse(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
