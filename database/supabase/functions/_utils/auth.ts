// Authentication utilities for Edge Functions
// Provides helpers for token extraction, user verification, and org ID lookup

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonClient, createServiceRoleClient } from "./supabase.ts";

/**
 * Extract Bearer token from request authorization header
 */
export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }
  return authHeader.replace("Bearer ", "") || null;
}

/**
 * Get authenticated user from token
 */
export async function getAuthUser(
  token: string
): Promise<{ id: string; email?: string } | null> {
  const supabaseAnon = createAnonClient();
  if (!supabaseAnon) {
    console.warn("SUPABASE_ANON_KEY not available, cannot verify token");
    return null;
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabaseAnon.auth.getUser(token);

    if (userError || !user) {
      return null;
    }

    return { id: user.id, email: user.email };
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return null;
  }
}

/**
 * Get organization ID from admin user (by email in organization_user table)
 */
export async function getOrganizationIdFromAdmin(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data: orgUser, error: orgUserError } = await supabase
    .from("organization_user")
    .select("organization_id")
    .eq("email", email)
    .maybeSingle();

  if (orgUserError || !orgUser) {
    return null;
  }

  return orgUser.organization_id;
}

/**
 * Get organization ID from worker (by auth_user_id in worker table)
 */
export async function getOrganizationIdFromWorker(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string | null> {
  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("organization_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (workerError || !worker) {
    return null;
  }

  return worker.organization_id;
}

/**
 * Get organization ID from user (tries both admin and worker strategies)
 */
export async function getOrganizationIdFromUser(
  req: Request
): Promise<string | null> {
  const supabase = createServiceRoleClient();

  // Try to get token
  const token = extractAuthToken(req);
  let authUserId: string | null = null;

  if (token) {
    const user = await getAuthUser(token);
    if (user) {
      authUserId = user.id;
    }
  }

  // Try to get email from request body (for admin users)
  let email: string | null = null;
  try {
    const body = await req.json();
    email = (body.email as string) || null;
  } catch {
    // Request body might be empty, that's okay
  }

  // Strategy 1: Try admin user by email
  if (email) {
    const orgId = await getOrganizationIdFromAdmin(supabase, email);
    if (orgId) {
      return orgId;
    }
  }

  // Strategy 2: Try worker by auth_user_id
  if (authUserId) {
    const orgId = await getOrganizationIdFromWorker(supabase, authUserId);
    if (orgId) {
      return orgId;
    }
  }

  return null;
}
