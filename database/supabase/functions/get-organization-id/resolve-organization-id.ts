import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationIdFromAdmin, getOrganizationIdFromWorker } from "../_utils/auth.ts";

export type ResolveOrganizationIdInput = {
  lookupEmail: string | null;
  authUserId: string | null;
  /** When true (mobile app), prefer the org where the user is an active worker. */
  preferWorker?: boolean;
};

/**
 * Resolves which organization context applies to the signed-in user.
 *
 * Dual-role users may be an admin in one org and a worker in another (same email).
 * Dashboard callers should prefer admin membership; mobile should prefer worker membership.
 */
export async function resolveOrganizationId(
  supabase: SupabaseClient,
  input: ResolveOrganizationIdInput
): Promise<string | null> {
  const { lookupEmail, authUserId, preferWorker = false } = input;

  const adminOrgId = lookupEmail ? await getOrganizationIdFromAdmin(supabase, lookupEmail) : null;

  const workerOrgId = authUserId ? await getOrganizationIdFromWorker(supabase, authUserId) : null;

  if (preferWorker) {
    return workerOrgId ?? adminOrgId;
  }

  return adminOrgId ?? workerOrgId;
}
