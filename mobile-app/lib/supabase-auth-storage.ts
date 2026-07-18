/** Stable auth storage key for the mobile app (independent of LAN IP changes). */
export const TALLY_RUNNER_AUTH_STORAGE_KEY = "sb-tally-runner-auth-token";

/**
 * Default storage key used by @supabase/supabase-js when no custom key is set.
 * @see node_modules/@supabase/supabase-js — `sb-${hostname.split(".")[0]}-auth-token`
 */
export function getDefaultSupabaseAuthStorageKey(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return `sb-${hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

export function isSupabaseAuthStorageKey(key: string): boolean {
  return /^sb-[^:]+-auth-token$/.test(key);
}
