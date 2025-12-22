import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

// Use validated environment variables
// getEnv() will throw in development if required vars are missing
// In production, it returns defaults to allow graceful degradation
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

// Use createBrowserClient from @supabase/ssr for proper cookie-based session handling
// This ensures the session is stored in cookies and accessible by the middleware
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
