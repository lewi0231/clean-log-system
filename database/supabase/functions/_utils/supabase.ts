// Supabase client utilities for Edge Functions
// Provides standardized Supabase client creation

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase JS type definitions in Deno can lag behind the hosted API surface.
 * In this repo we rely on `auth.admin.getUserByEmail()` in a few edge functions.
 *
 * Centralize the (safe) type cast here so callsites stay clean.
 */
export async function getAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<
  { data: { user: { id: string } | null } | null; error: unknown | null }
> {
  const admin = supabase.auth.admin as unknown as {
    getUserByEmail: (
      email: string,
    ) => Promise<{ data: { user: { id: string } | null } | null; error: unknown | null }>;
  };

  return await admin.getUserByEmail(email);
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
