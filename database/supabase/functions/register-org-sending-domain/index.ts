import { serve } from "server";
import {
  requireOrgAdminFromRequest,
  resendHeaders,
  sendingRegionOrDefault,
  toDisplayStatus,
} from "../_utils/org-sending-domain-edge.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, {
    functionName: "register-org-sending-domain",
  });
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }
  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id", "domain_name"]);
    if (!v.valid) {
      return errorResponse("organization_id and domain_name are required", 400);
    }
    const organization_id = body.organization_id as string;
    const domain_name = String(body.domain_name).trim().toLowerCase();

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

    const { data: org, error: orgErr } = await supabase
      .from("organization")
      .select("id, custom_email_domain_enabled")
      .eq("id", organization_id)
      .single();
    if (orgErr || !org) {
      return errorResponse("Organization not found", 404);
    }
    if (!org.custom_email_domain_enabled) {
      return errorResponse(
        "Custom email domain is not enabled for this organization",
        403,
      );
    }

    const { data: existingRow, error: exErr } = await supabase
      .from("organization_sending_domain")
      .select("id, resend_domain_id, domain_name")
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (exErr) throw exErr;

    // Same domain re-submitted: sync from Resend instead of create (idempotent)
    if (
      existingRow?.resend_domain_id &&
      existingRow.domain_name === domain_name
    ) {
      const getRes = await fetch(
        `https://api.resend.com/domains/${existingRow.resend_domain_id}`,
        { method: "GET", headers: resendHeaders() },
      );
      const getText = await getRes.text();
      let getJson: { status?: string; records?: unknown } = {};
      try {
        getJson = getText ? JSON.parse(getText) as typeof getJson : {};
      } catch {
        /* */
      }
      if (!getRes.ok) {
        logger.error("Resend get domain failed (re-register same name)", undefined, {
          status: getRes.status,
          body: getText.slice(0, 500),
        });
        return errorResponse(
          "Could not load domain from email provider. Try Remove domain and add it again, or contact support.",
          502,
        );
      }
      const resendStatus = (getJson.status as string) || "pending";
      const display_status = toDisplayStatus(resendStatus);
      const { error: updSame } = await supabase
        .from("organization_sending_domain")
        .update({
          resend_status: resendStatus,
          display_status,
          dns_records_snapshot: getJson.records
            ? (getJson.records as Record<string, unknown>)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id);
      if (updSame) throw updSame;
      return jsonResponse({
        success: true,
        resend_domain_id: existingRow.resend_domain_id,
        domain_name,
        resend_status: resendStatus,
        display_status,
        dns_records: getJson.records ?? null,
        reusedExisting: true,
      });
    }

    const previousResendId =
      existingRow?.resend_domain_id &&
        existingRow.domain_name !== domain_name
        ? existingRow.resend_domain_id
        : null;

    const region = sendingRegionOrDefault();
    const res = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: resendHeaders(),
      body: JSON.stringify({ name: domain_name, region }),
    });
    const text = await res.text();
    let json: { id?: string; status?: string; records?: unknown } = {};
    try {
      json = text ? JSON.parse(text) as typeof json : {};
    } catch {
      /* keep json empty */
    }
    if (!res.ok) {
      logger.error("Resend create domain failed", undefined, {
        status: res.status,
        body: text.slice(0, 500),
      });
      return errorResponse(
        "Unable to register domain with email provider. It may already be in use.",
        400,
      );
    }

    const resendId = json.id;
    const resendStatus = (json.status as string) || "pending";
    const display_status = toDisplayStatus(resendStatus);

    const { error: upsertErr } = await supabase
      .from("organization_sending_domain")
      .upsert(
        {
          organization_id,
          resend_domain_id: resendId,
          domain_name,
          resend_status: resendStatus,
          display_status,
          dns_records_snapshot: json.records
            ? (json.records as Record<string, unknown>)
            : null,
          sending_region: region,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
    if (upsertErr) {
      logger.error("DB upsert failed after Resend create", upsertErr);
      if (resendId) {
        try {
          await fetch(`https://api.resend.com/domains/${resendId}`, {
            method: "DELETE",
            headers: resendHeaders(),
          });
        } catch {
          /* best-effort cleanup */
        }
      }
      return errorResponse("Failed to save domain. Please try again.", 500);
    }

    if (previousResendId && previousResendId !== resendId) {
      const delOld = await fetch(
        `https://api.resend.com/domains/${previousResendId}`,
        { method: "DELETE", headers: resendHeaders() },
      );
      if (!delOld.ok) {
        const dt = await delOld.text();
        logger.warn("Could not delete previous Resend domain after domain change", {
          status: delOld.status,
          body: dt.slice(0, 300),
          previousResendId,
        });
      }
    }

    return jsonResponse({
      success: true,
      resend_domain_id: resendId,
      domain_name,
      resend_status: resendStatus,
      display_status,
      dns_records: json.records ?? null,
    });
  } catch (e) {
    logger.error("register-org-sending-domain", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unexpected error",
      500,
    );
  }
});
