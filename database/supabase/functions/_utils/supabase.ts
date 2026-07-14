// Supabase client utilities for Edge Functions
// Provides standardized Supabase client creation

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type AuthUserLookup = {
  id: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

/** Normalize email for auth lookups (GoTrue stores lowercase). */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUserLookup(user: {
  id: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
}): AuthUserLookup {
  return {
    id: user.id,
    email_confirmed_at: user.email_confirmed_at ?? null,
    user_metadata: user.user_metadata,
  };
}

async function tryGetUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<AuthUserLookup | null> {
  // getUserByEmail is not in all @supabase/auth-js type/runtime builds; probe at runtime.
  const admin = supabase.auth.admin as {
    getUserByEmail?: (email: string) => Promise<{
      data: {
        user: {
          id: string;
          email_confirmed_at?: string | null;
          user_metadata?: Record<string, unknown>;
        } | null;
      };
      error: { message?: string } | null;
    }>;
  };

  if (typeof admin.getUserByEmail !== "function") {
    return null;
  }

  const { data, error } = await admin.getUserByEmail(email);
  if (error || !data?.user) {
    return null;
  }

  return toAuthUserLookup(data.user);
}

async function findAuthUserViaList(
  supabase: SupabaseClient,
  normalizedEmail: string
): Promise<AuthUserLookup | null> {
  let page = 1;
  const perPage = 1000;
  const maxPages = 10;

  while (page <= maxPages) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw error;
    }

    const match = data.users.find(
      (u) => u.email && normalizeAuthEmail(u.email) === normalizedEmail
    );
    if (match) {
      return toAuthUserLookup(match);
    }

    if (data.users.length < perPage) {
      break;
    }
    page++;
  }

  return null;
}

/**
 * Look up an auth user by email using the admin API.
 * Falls back to paginated listUsers when getUserByEmail misses (case mismatch, API quirks).
 */
export async function getAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ data: { user: AuthUserLookup | null } | null; error: unknown | null }> {
  const trimmed = email.trim();
  const normalized = normalizeAuthEmail(trimmed);
  const candidates = trimmed === normalized ? [normalized] : [normalized, trimmed];

  for (const candidate of candidates) {
    try {
      const user = await tryGetUserByEmail(supabase, candidate);
      if (user) {
        return { data: { user }, error: null };
      }
    } catch {
      // Try next candidate or listUsers fallback.
    }
  }

  try {
    const user = await findAuthUserViaList(supabase, normalized);
    return { data: { user }, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/** Look up an auth user by id (e.g. worker.auth_user_id from a partial signup). */
export async function getAuthUserById(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: { user: AuthUserLookup | null } | null; error: unknown | null }> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      return { data: null, error };
    }

    return {
      data: data?.user ? { user: toAuthUserLookup(data.user) } : { user: null },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Create a Supabase client with service role key (admin access)
 */
export function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Create a Supabase client with anon key (for auth verification)
 */
export function createAnonClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createClient(supabaseUrl, anonKey);
}
