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
  token: string,
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
  email: string,
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
 * Get organization user details (id, organization_id, role) by email
 */
export async function getOrganizationUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string; organization_id: string; role: string } | null> {
  const { data: orgUser, error: orgUserError } = await supabase
    .from("organization_user")
    .select("id, organization_id, role")
    .eq("email", email)
    .maybeSingle();

  if (orgUserError || !orgUser) {
    return null;
  }

  return orgUser;
}

/**
 * Get organization ID from worker (by auth_user_id in worker table)
 */
export async function getOrganizationIdFromWorker(
  supabase: SupabaseClient,
  authUserId: string,
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
  req: Request,
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

/**
 * Verify that a user (by email or auth_user_id) belongs to a specific organization
 * Returns true if user is a member, false otherwise
 */
export async function verifyOrganizationMembership(
  supabase: SupabaseClient,
  organizationId: string,
  userEmail?: string | null,
  authUserId?: string | null,
): Promise<boolean> {
  // Try admin membership by email
  if (userEmail) {
    const { data: orgUser, error: orgUserError } = await supabase
      .from("organization_user")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", userEmail)
      .maybeSingle();

    if (!orgUserError && orgUser) {
      return true;
    }
  }

  // Try worker membership by auth_user_id
  if (authUserId) {
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!workerError && worker) {
      return true;
    }
  }

  return false;
}

/**
 * Verify organization membership from a request
 * Extracts auth token, gets user info, and verifies membership
 * Returns user info if verified, null if not verified
 * This is a convenience wrapper for common edge function patterns
 */
export async function verifyOrganizationMembershipFromRequest(
  req: Request,
  organizationId: string,
  supabase: SupabaseClient,
  body?: Record<string, unknown> | null,
): Promise<{ userId: string | null; userEmail: string | null } | null> {
  // Extract user from auth token
  let userId: string | null = null;
  let userEmail: string | null = null;
  const token = extractAuthToken(req);

  if (token) {
    const authUser = await getAuthUser(token);
    if (authUser?.id) {
      userId = authUser.id;
      userEmail = authUser.email ?? null;
    }
  }

  // Try to get email from request body if provided or if not already found
  if (!userEmail && body && typeof body.email === "string") {
    userEmail = body.email;
  }

  // If we have user info, verify membership
  if (userId || userEmail) {
    const isMember = await verifyOrganizationMembership(
      supabase,
      organizationId,
      userEmail,
      userId,
    );

    if (!isMember) {
      return null;
    }
  } else {
    // No auth token provided - return null to indicate verification failed
    return null;
  }

  return { userId, userEmail };
}
