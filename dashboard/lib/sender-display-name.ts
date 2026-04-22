import type { User } from "@supabase/supabase-js";

/**
 * Best-effort display name for invoice email sign-off (sender).
 */
export function senderDisplayNameFromUser(user: User | null): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full = meta?.full_name ?? meta?.name;
  if (typeof full === "string" && full.trim()) return full.trim();
  if (user.email) return user.email.split("@")[0];
  return undefined;
}
