/**
 * Require a valid JWT and verified membership in {@link organizationId}.
 * Uses token-derived identity only (no body.email fallback).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractAuthToken, getAuthUser, verifyOrganizationMembership } from "./auth.ts";
import { errorResponse } from "./http.ts";

export type AuthenticatedOrgMemberResult =
  | { ok: true; userId: string; userEmail: string | null }
  | { ok: false; response: Response };

export async function requireAuthenticatedOrgMember(
  req: Request,
  organizationId: string,
  supabase: SupabaseClient
): Promise<AuthenticatedOrgMemberResult> {
  const token = extractAuthToken(req);
  if (!token) {
    return { ok: false, response: errorResponse("Authentication required", 401) };
  }

  const authUser = await getAuthUser(token);
  if (!authUser?.id) {
    return { ok: false, response: errorResponse("User not found", 401) };
  }

  const isMember = await verifyOrganizationMembership(
    supabase,
    organizationId,
    authUser.email ?? null,
    authUser.id
  );

  if (!isMember) {
    return {
      ok: false,
      response: errorResponse("You do not have permission to access this organization", 403),
    };
  }

  return {
    ok: true,
    userId: authUser.id,
    userEmail: authUser.email ?? null,
  };
}
