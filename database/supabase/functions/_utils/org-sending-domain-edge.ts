import type { SupabaseClient } from "@supabase/supabase-js";
import { createLoggerWithoutRequest } from "./logger.ts";
import { requireAuthenticatedOrgMember } from "./require-authenticated-org-member.ts";

/**
 * Returns true if the request's user is an active org admin for `organizationId`.
 */
export async function isActiveOrgAdmin(
  supabase: SupabaseClient,
  organizationId: string,
  authUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_user")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;
  return data.role === "admin";
}

export async function requireOrgAdminFromRequest(
  req: Request,
  organizationId: string,
  supabase: SupabaseClient,
  _body: Record<string, unknown> | null
): Promise<{ ok: true; userId: string } | { ok: false; status: number; message: string }> {
  const logger = createLoggerWithoutRequest({
    functionName: "requireOrgAdminFromRequest",
  });
  const membershipGate = await requireAuthenticatedOrgMember(req, organizationId, supabase);
  if (!membershipGate.ok) {
    let message = "You do not have permission to access this organization";
    try {
      const j = (await membershipGate.response.json()) as { detail?: string };
      if (j.detail) message = j.detail;
    } catch {
      /* non-JSON body */
    }
    return {
      ok: false,
      status: membershipGate.response.status,
      message,
    };
  }
  const admin = await isActiveOrgAdmin(supabase, organizationId, membershipGate.userId);
  if (!admin) {
    logger.warn("Non-admin attempted org sending domain action", {
      organizationId,
    });
    return { ok: false, status: 403, message: "Admin access required" };
  }
  return { ok: true, userId: membershipGate.userId };
}

export function resendHeaders(): Record<string, string> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export function sendingRegionOrDefault(): string {
  return Deno.env.get("RESEND_SENDING_REGION")?.trim() || "us-east-1";
}

/** Map Resend status + our flags to display_status */
export function toDisplayStatus(
  resendStatus: string
): "pending_setup" | "pending_dns" | "verified" | "error" | "disabled" {
  if (resendStatus === "verified") return "verified";
  if (resendStatus === "failed" || resendStatus === "temporary_failure") {
    return "error";
  }
  if (resendStatus === "pending" || resendStatus === "not_started") {
    return "pending_dns";
  }
  return "pending_setup";
}
