import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// IMPORTANT:
// Don't throw at module import time. This file is imported by many client components,
// and Next.js may evaluate modules during build/SSR even when env vars aren't present.
// Instead, warn in development and let runtime calls surface a more contextual error.
if (
  process.env.NODE_ENV !== "production" &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  console.warn(
    "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Supabase calls will fail until these are set.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
