/**
 * Authentication helpers for E2E tests
 *
 * Provides utilities for creating verified users and managing authentication
 * state during Playwright E2E tests.
 */

import { getSupabaseClient } from "./db-seeder";

interface CreateUserOptions {
  email: string;
  password: string;
  emailConfirm?: boolean;
  userMetadata?: Record<string, unknown>;
}

interface AuthUser {
  id: string;
  email: string;
}

/**
 * Create a verified admin user (bypasses email verification)
 */
export async function createVerifiedAdmin(
  organizationId: string,
  options: CreateUserOptions
): Promise<AuthUser> {
  const supabase = getSupabaseClient();

  // Create auth user with email_confirm: true to bypass verification
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: options.emailConfirm ?? true,
    user_metadata: {
      role: "admin",
      organization_id: organizationId,
      ...options.userMetadata,
    },
  });

  if (authError) {
    throw new Error(`Failed to create admin auth user: ${authError.message}`);
  }

  // Create organization_user record
  const { error: orgUserError } = await supabase.from("organization_user").insert({
    organization_id: organizationId,
    email: options.email,
    role: "admin",
    auth_user_id: authData.user.id,
  });

  if (orgUserError) {
    // Cleanup auth user if org_user creation fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Failed to create organization_user: ${orgUserError.message}`);
  }

  return {
    id: authData.user.id,
    email: options.email,
  };
}

/**
 * Create an active worker (bypasses invitation flow and email verification)
 */
export async function createActiveWorker(
  organizationId: string,
  workerData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }
): Promise<{ workerId: string; authUserId: string }> {
  const supabase = getSupabaseClient();

  // Create auth user with email_confirm: true
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: workerData.email,
    password: workerData.password,
    email_confirm: true,
    user_metadata: {
      role: "worker",
      organization_id: organizationId,
    },
  });

  if (authError) {
    throw new Error(`Failed to create worker auth user: ${authError.message}`);
  }

  // Create worker record with active: true (bypass invitation)
  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .insert({
      organization_id: organizationId,
      first_name: workerData.firstName,
      last_name: workerData.lastName,
      name: `${workerData.firstName} ${workerData.lastName}`,
      email: workerData.email,
      phone: workerData.phone,
      active: true,
      auth_user_id: authData.user.id,
    })
    .select()
    .single();

  if (workerError) {
    // Cleanup auth user if worker creation fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Failed to create worker: ${workerError.message}`);
  }

  return {
    workerId: worker.id,
    authUserId: authData.user.id,
  };
}

/**
 * Delete an auth user and related records
 */
export async function deleteAuthUser(authUserId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Delete organization_user records
  await supabase.from("organization_user").delete().eq("auth_user_id", authUserId);

  // Delete worker records (if any)
  await supabase.from("worker").delete().eq("auth_user_id", authUserId);

  // Delete auth user
  const { error } = await supabase.auth.admin.deleteUser(authUserId);
  if (error) {
    console.warn(`Warning: Failed to delete auth user ${authUserId}: ${error.message}`);
  }
}

/**
 * Get auth session for a user (useful for API testing)
 */
export async function getAuthSession(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in: ${error.message}`);
  }

  if (!data.session) {
    throw new Error("No session returned from sign in");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

/**
 * Verify a user's email directly (admin operation)
 */
export async function verifyUserEmail(authUserId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to verify email: ${error.message}`);
  }
}

/**
 * Check if a user exists by email
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  return data.users.some((user) => user.email === email);
}
