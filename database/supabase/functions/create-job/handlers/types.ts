import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolved auth user shape from `getAuthUser` */
export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type CreateJobContext = {
  supabaseAdmin: SupabaseClient;
  authUser: AuthUser;
  authUserId: string;
  userEmail: string | null;
  organizationId: string;
  usePredefinedLocations: boolean;
  confirmationTimeoutHours: number;
  editWindowMinutes: number;
};

export type ValidatedCreateJobRequest = {
  normalizedLocationId: string | null;
  colleagueIds: string[] | undefined;
  submissionDataJsonb: Record<string, unknown> | null;
};
