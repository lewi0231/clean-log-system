import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationName } from "./email.ts";

export type CrossOrgEmailMembership = "admin" | "worker";

export type CrossOrgEmailConflict = {
  email: string;
  requestedOrganizationId: string;
  existingOrganizationId: string;
  existingOrganizationName: string | null;
  existingAs: CrossOrgEmailMembership[];
};

export type WorkerAuthUserConflict = {
  authUserId: string;
  requestedOrganizationId: string;
  existingOrganizationId: string;
  existingOrganizationName: string | null;
};

export function normalizeLookupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function formatCrossOrgEmailError(conflict: CrossOrgEmailConflict): string {
  const orgLabel = conflict.existingOrganizationName ?? "another organization";
  const roleLabels = conflict.existingAs.map((role) =>
    role === "admin" ? "a dashboard user" : "a worker"
  );
  const roleText =
    roleLabels.length === 1
      ? roleLabels[0]
      : `${roleLabels.slice(0, -1).join(", ")} and ${roleLabels.at(-1)}`;

  return `This email is already registered as ${roleText} in ${orgLabel}. Each email can only belong to one organization.`;
}

export function formatWorkerAuthUserConflictError(conflict: WorkerAuthUserConflict): string {
  const orgLabel = conflict.existingOrganizationName ?? "another organization";
  return `This account is already a worker in ${orgLabel}. Each email can only belong to one organization. Remove the worker record there first, or use a different email.`;
}

/**
 * Returns conflict details when {@link email} is already tied to a different organization.
 * Same-org duplicates (including admin + worker) are allowed and return null.
 */
export async function findCrossOrganizationEmailConflict(
  supabase: SupabaseClient,
  email: string,
  organizationId: string
): Promise<CrossOrgEmailConflict | null> {
  const normalizedEmail = normalizeLookupEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const existingAs = new Set<CrossOrgEmailMembership>();
  let existingOrganizationId: string | null = null;

  const { data: orgUsers, error: orgUserError } = await supabase
    .from("organization_user")
    .select("organization_id")
    .ilike("email", normalizedEmail)
    .neq("organization_id", organizationId)
    .limit(1);

  if (orgUserError) {
    throw orgUserError;
  }

  if (orgUsers && orgUsers.length > 0) {
    existingAs.add("admin");
    existingOrganizationId = orgUsers[0].organization_id;
  }

  const { data: workers, error: workerError } = await supabase
    .from("worker")
    .select("organization_id")
    .ilike("email", normalizedEmail)
    .neq("organization_id", organizationId)
    .limit(1);

  if (workerError) {
    throw workerError;
  }

  if (workers && workers.length > 0) {
    existingAs.add("worker");
    if (!existingOrganizationId) {
      existingOrganizationId = workers[0].organization_id;
    }
  }

  if (!existingOrganizationId || existingAs.size === 0) {
    return null;
  }

  const existingOrganizationName = await getOrganizationName(supabase, existingOrganizationId);

  return {
    email: normalizedEmail,
    requestedOrganizationId: organizationId,
    existingOrganizationId,
    existingOrganizationName,
    existingAs: [...existingAs],
  };
}

export async function findWorkerAuthUserInOtherOrganization(
  supabase: SupabaseClient,
  authUserId: string,
  organizationId: string
): Promise<WorkerAuthUserConflict | null> {
  const { data: worker, error } = await supabase
    .from("worker")
    .select("organization_id")
    .eq("auth_user_id", authUserId)
    .neq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!worker) {
    return null;
  }

  const existingOrganizationName = await getOrganizationName(supabase, worker.organization_id);

  return {
    authUserId,
    requestedOrganizationId: organizationId,
    existingOrganizationId: worker.organization_id,
    existingOrganizationName,
  };
}
