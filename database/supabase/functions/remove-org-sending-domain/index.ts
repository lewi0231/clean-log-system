import { serve } from "server";
import { requireOrgAdminFromRequest, resendHeaders } from "../_utils/org-sending-domain-edge.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, { functionName: "remove-org-sending-domain" });
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }
  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id"]);
    if (!v.valid) {
      return errorResponse("organization_id is required", 400);
    }
    const organization_id = body.organization_id as string;

    const supabase = createServiceRoleClient();
    const gate = await requireOrgAdminFromRequest(
      req,
      organization_id,
      supabase,
      body,
    );
    if (!gate.ok) {
      return errorResponse(gate.message, gate.status);
    }

    // Allow remove even when custom_email_domain_enabled is false (e.g. after
    // plan downgrade) so admins can clear Resend + DB and stop orphaned domains.

    const { data: row } = await supabase
      .from("organization_sending_domain")
      .select("id, resend_domain_id")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (row?.resend_domain_id) {
      const del = await fetch(
        `https://api.resend.com/domains/${row.resend_domain_id}`,
        { method: "DELETE", headers: resendHeaders() },
      );
      if (!del.ok) {
        const t = await del.text();
        logger.warn("Resend delete domain non-ok", { status: del.status, t: t.slice(0, 200) });
      }
    }

    if (row?.id) {
      const { error: delRowErr } = await supabase
        .from("organization_sending_domain")
        .delete()
        .eq("id", row.id);
      if (delRowErr) throw delRowErr;
    }

    return jsonResponse({ success: true });
  } catch (e) {
    logger.error("remove-org-sending-domain", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unexpected error",
      500,
    );
  }
});
