/**
 * Shared Phase 3+ gate: JWT + org membership, single Supabase client for the handler.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedOrgMember } from "./require-authenticated-org-member.ts";
import { createServiceRoleClient } from "./supabase.ts";

export type GatedOrgRequestContext = {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | null;
};

export type GateOrganizationRequestResult =
  | { ok: true; ctx: GatedOrgRequestContext }
  | { ok: false; response: Response };

/**
 * Require authenticated membership in {@link organizationId}, then yield a service-role client.
 */
export async function gateOrganizationRequest(
  req: Request,
  organizationId: string,
  logger: { warn: (msg: string, meta?: Record<string, unknown>) => void }
): Promise<GateOrganizationRequestResult> {
  const supabase = createServiceRoleClient();
  const gate = await requireAuthenticatedOrgMember(req, organizationId, supabase);
  if (!gate.ok) {
    if (gate.response.status === 403) {
      logger.warn("Unauthorized organization access attempt", {
        organization_id: organizationId,
      });
    }
    return { ok: false, response: gate.response };
  }
  return {
    ok: true,
    ctx: {
      supabase,
      userId: gate.userId,
      userEmail: gate.userEmail,
    },
  };
}
