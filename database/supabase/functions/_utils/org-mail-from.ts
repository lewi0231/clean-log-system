/**
 * Resolve Resend "From" address per S2 §4 / §4.4 (org custom domain vs platform).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_DISPLAY_NAME } from "./brand.ts";
import { createLoggerWithoutRequest } from "./logger.ts";

export type MailKind =
  | "org_signup_verification"
  | "admin_user_invitation"
  | "worker_invitation"
  | "invoice"
  | "payment_confirmation"
  | "admin_invoice_notification"
  | "invoice_reminder"
  | "feedback_request";

export type FromDomainSource = "org" | "platform";

export interface ResolveOrgMailFromResult {
  from: string;
  fromDomainSource: FromDomainSource;
}

/** Resend API domain status when the domain can be used for sending */
export const RESEND_DOMAIN_VERIFIED = "verified";

/**
 * Strip characters that must not appear in RFC 5322 display name or local part construction.
 */
export function sanitizeForFromHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1F\x7F]/g, "").trim();
}

function localPartForKind(kind: MailKind): string {
  switch (kind) {
    case "org_signup_verification":
      return "noreply";
    case "admin_user_invitation":
      return "invitations";
    case "worker_invitation":
      return "onboarding";
    case "invoice":
    case "invoice_reminder":
      return "invoices";
    case "payment_confirmation":
      return "payments";
    case "admin_invoice_notification":
      return "noreply";
    case "feedback_request":
      return "noreply";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function displayNameForKind(
  kind: MailKind,
  organizationName: string,
): string {
  const safe = sanitizeForFromHeader(organizationName) || "Organization";
  if (kind === "org_signup_verification") {
    return APP_DISPLAY_NAME;
  }
  return safe;
}

export interface ResolveOrgMailFromInput {
  supabase: SupabaseClient;
  organizationId: string;
  organizationName: string;
  mailKind: MailKind;
  /** Platform fallback domain from RESEND_FROM_DOMAIN (hostname only, no @) */
  platformDomain: string;
}

/**
 * Load org custom domain host if entitled, enabled, and verified in DB + Resend snapshot.
 */
async function resolveEffectiveMailHost(
  supabase: SupabaseClient,
  organizationId: string,
  platformDomain: string,
): Promise<{ host: string; source: FromDomainSource }> {
  const logger = createLoggerWithoutRequest({
    functionName: "resolveEffectiveMailHost",
  });

  if (!organizationId) {
    return { host: platformDomain, source: "platform" };
  }

  try {
    const { data: orgRow, error: orgErr } = await supabase
      .from("organization")
      .select("custom_email_domain_enabled")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgErr) {
      logger.warn("organization lookup failed; using platform domain", {
        message: orgErr.message,
      });
      return { host: platformDomain, source: "platform" };
    }

    if (!orgRow?.custom_email_domain_enabled) {
      return { host: platformDomain, source: "platform" };
    }

    const { data: domainRow, error: domainErr } = await supabase
      .from("organization_sending_domain")
      .select("domain_name, resend_status, enabled")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (domainErr) {
      logger.warn("organization_sending_domain lookup failed", {
        message: domainErr.message,
      });
      return { host: platformDomain, source: "platform" };
    }

    if (
      domainRow &&
      domainRow.enabled &&
      domainRow.resend_status === RESEND_DOMAIN_VERIFIED &&
      domainRow.domain_name
    ) {
      return {
        host: sanitizeForFromHeader(domainRow.domain_name),
        source: "org",
      };
    }
  } catch (e) {
    logger.warn("resolveEffectiveMailHost threw; using platform domain", {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return { host: platformDomain, source: "platform" };
}

/**
 * Build full From header per S2 §4.4 precedence.
 */
export async function resolveOrgMailFrom(
  input: ResolveOrgMailFromInput,
): Promise<ResolveOrgMailFromResult> {
  const { supabase, organizationId, organizationName, mailKind, platformDomain } =
    input;
  const local = localPartForKind(mailKind);
  const display = displayNameForKind(mailKind, organizationName);

  // 1) Org signup verification — always platform + Tally Runner (see APP_DISPLAY_NAME)
  if (mailKind === "org_signup_verification") {
    return {
      from: `${display} <${local}@${platformDomain}>`,
      fromDomainSource: "platform",
    };
  }

  const adminInvitesDomain = Deno.env.get("RESEND_ADMIN_INVITES_FROM_DOMAIN")
    ?.trim();

  // 2–3) Admin user invitation — env override wins for @ host (S2 §4.4 steps 2–3)
  if (mailKind === "admin_user_invitation") {
    if (adminInvitesDomain) {
      const host = sanitizeForFromHeader(adminInvitesDomain);
      return {
        from: `${display} <${local}@${host}>`,
        fromDomainSource: "platform",
      };
    }
    const { host, source } = await resolveEffectiveMailHost(
      supabase,
      organizationId,
      platformDomain,
    );
    return {
      from: `${display} <${local}@${host}>`,
      fromDomainSource: source,
    };
  }

  // 4) All other kinds
  const { host, source } = await resolveEffectiveMailHost(
    supabase,
    organizationId,
    platformDomain,
  );
  return {
    from: `${display} <${local}@${host}>`,
    fromDomainSource: source,
  };
}
