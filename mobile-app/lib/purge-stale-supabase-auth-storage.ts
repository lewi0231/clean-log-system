import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isSupabaseAuthStorageKey,
  TALLY_RUNNER_AUTH_STORAGE_KEY,
} from "@/lib/supabase-auth-storage";

const SUPABASE_URL_STORAGE_KEY = "tally-runner:last-supabase-url";

function relatedAuthKeysForStorageKey(storageKey: string): string[] {
  return [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`];
}

/**
 * Remove Supabase auth keys from prior local/dev URLs (e.g. after LAN IP changes).
 * Prevents gotrue-js lock contention between sb-10-* and sb-192-* storage keys.
 */
export async function purgeStaleSupabaseAuthStorage(supabaseUrl: string): Promise<void> {
  const currentKey = TALLY_RUNNER_AUTH_STORAGE_KEY;
  const previousUrl = await AsyncStorage.getItem(SUPABASE_URL_STORAGE_KEY);
  const urlChanged = previousUrl !== supabaseUrl;

  const allKeys = await AsyncStorage.getAllKeys();
  const staleAuthKeys = allKeys.filter(
    (key) => isSupabaseAuthStorageKey(key) && key !== currentKey
  );

  const staleRelatedKeys = allKeys.filter((key) =>
    staleAuthKeys.some(
      (staleKey) => key === `${staleKey}-code-verifier` || key === `${staleKey}-user`
    )
  );

  const keysToRemove = [...new Set([...staleAuthKeys, ...staleRelatedKeys])];

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
    if (__DEV__) {
      console.log("🧹 Cleared stale Supabase auth storage keys", keysToRemove);
    }
  }

  if (urlChanged) {
    await AsyncStorage.setItem(SUPABASE_URL_STORAGE_KEY, supabaseUrl);
  }
}

export { relatedAuthKeysForStorageKey };
