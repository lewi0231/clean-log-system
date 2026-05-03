import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Browser Supabase client must not be created at module load time: during `next build`
 * production env validation intentionally falls back to empty strings when vars are
 * missing, and createBrowserClient("", "") throws. Lazily create on first property access.
 */
let browserClient: SupabaseClient | null = null;

function getOrCreateBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase client environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY for the anon/publishable key) " +
        "in Vercel Project Settings → Environment Variables so they are available at build time."
    );
  }
  browserClient = createBrowserClient(url, key);
  return browserClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getOrCreateBrowserClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
