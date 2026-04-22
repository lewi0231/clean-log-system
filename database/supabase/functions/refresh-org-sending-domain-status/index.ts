import { serve } from "server";
import {
  requireOrgAdminFromRequest,
  resendHeaders,
  toDisplayStatus,
} from "../_utils/org-sending-domain-edge.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, {
    functionName: "refresh-org-sending-domain-status",
  });
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

    const { data: row, error: rowErr } = await supabase
      .from("organization_sending_domain")
      .select("resend_domain_id, domain_name")
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row?.resend_domain_id) {
      return errorResponse("No domain registered for this organization", 404);
    }

    const res = await fetch(
      `https://api.resend.com/domains/${row.resend_domain_id}`,
      { method: "GET", headers: resendHeaders() },
    );
    const text = await res.text();
    let json: { status?: string; records?: unknown } = {};
    try {
      json = text ? JSON.parse(text) as typeof json : {};
    } catch {
      /* */
    }
    if (!res.ok) {
      logger.error("Resend get domain failed", undefined, {
        status: res.status,
        body: text.slice(0, 500),
      });
      return errorResponse("Failed to refresh domain from provider", 502);
    }

    const resendStatus = (json.status as string) || "pending";
    const display_status = toDisplayStatus(resendStatus);

    const { error: updErr } = await supabase
      .from("organization_sending_domain")
      .update({
        resend_status: resendStatus,
        display_status,
        dns_records_snapshot: json.records
          ? (json.records as Record<string, unknown>)
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organization_id);
    if (updErr) throw updErr;

    return jsonResponse({
      success: true,
      resend_status: resendStatus,
      display_status,
      dns_records: json.records ?? null,
      domain_name: row.domain_name,
    });
  } catch (e) {
    logger.error("refresh-org-sending-domain-status", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unexpected error",
      500,
    );
  }
});
