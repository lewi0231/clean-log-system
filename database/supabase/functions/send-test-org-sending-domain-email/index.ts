import { serve } from "server";
import { requireOrgAdminFromRequest, resendHeaders } from "../_utils/org-sending-domain-edge.ts";
import { APP_DISPLAY_NAME } from "../_utils/brand.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { RESEND_DOMAIN_VERIFIED, resolveOrgMailFrom } from "../_utils/org-mail-from.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

await loadEnvIfLocal();

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const logger = createLogger(req, {
    functionName: "send-test-org-sending-domain-email",
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
    const gate = await requireOrgAdminFromRequest(req, organization_id, supabase, body);
    if (!gate.ok) {
      return errorResponse(gate.message, gate.status);
    }

    const { data: org, error: orgErr } = await supabase
      .from("organization")
      .select("id, name, custom_email_domain_enabled")
      .eq("id", organization_id)
      .single();
    if (orgErr || !org) {
      return errorResponse("Organization not found", 404);
    }
    if (!org.custom_email_domain_enabled) {
      return errorResponse("Custom email domain is not enabled for this organization", 403);
    }

    const { data: domainRow, error: domainErr } = await supabase
      .from("organization_sending_domain")
      .select("domain_name, resend_status, enabled")
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (domainErr) throw domainErr;
    if (!domainRow?.domain_name) {
      return errorResponse("No domain registered for this organization", 404);
    }
    if (!domainRow.enabled || domainRow.resend_status !== RESEND_DOMAIN_VERIFIED) {
      return errorResponse(
        "Domain must be verified before sending a test email. Click Check DNS and try again.",
        400
      );
    }

    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(gate.userId);
    if (authErr || !authUser.user?.email) {
      logger.error("Could not load admin email for test send", authErr);
      return errorResponse("Could not determine your email address", 500);
    }
    const recipient = authUser.user.email;

    const platformDomain = Deno.env.get("RESEND_FROM_DOMAIN")?.trim();
    if (!platformDomain) {
      return errorResponse("Email service is not configured", 500);
    }

    const { from, fromDomainSource } = await resolveOrgMailFrom({
      supabase,
      organizationId: organization_id,
      organizationName: org.name || "Organization",
      mailKind: "invoice",
      platformDomain,
    });

    if (fromDomainSource !== "org") {
      return errorResponse(
        "Custom domain is not active for sending yet. Verify DNS and try again.",
        400
      );
    }

    if (Deno.env.get("SKIP_EMAIL_SENDING") === "true") {
      logger.info("SKIP_EMAIL_SENDING: would send domain test email", {
        to: recipient,
        from,
      });
      return jsonResponse({
        success: true,
        skipped: true,
        to: recipient,
        from,
        domain_name: domainRow.domain_name,
      });
    }

    const subject = `${APP_DISPLAY_NAME}: Test email from ${domainRow.domain_name}`;
    const html = `
      <p>This is a test message from <strong>${org.name || "your organization"}</strong>.</p>
      <p>If you received this, your custom sending domain
        <code>${domainRow.domain_name}</code> is working.</p>
      <p style="color:#666;font-size:12px;">From: ${from}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders(),
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
        tags: [
          { name: "category", value: "org-sending-domain-test" },
          {
            name: "organization_id",
            value: organization_id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50),
          },
        ],
      }),
    });
    const text = await res.text();
    let json: { id?: string; message?: string } = {};
    try {
      json = text ? (JSON.parse(text) as typeof json) : {};
    } catch {
      /* */
    }
    if (!res.ok) {
      logger.error("Resend test email failed", undefined, {
        status: res.status,
        body: text.slice(0, 500),
      });
      return errorResponse(
        json.message ? `Failed to send test email: ${json.message}` : "Failed to send test email",
        502
      );
    }

    return jsonResponse({
      success: true,
      to: recipient,
      from,
      domain_name: domainRow.domain_name,
      email_id: json.id ?? null,
    });
  } catch (e) {
    logger.error("send-test-org-sending-domain-email", e);
    return errorResponse(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
