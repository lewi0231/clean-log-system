// Environment utilities for Edge Functions
// Handles conditional dotenv loading for local development

import { load } from "dotenv";

/**
 * Load environment variables from .env file if available (local development)
 * Edge Functions run from database/supabase/functions/, so .env should be in current directory
 * Safe to call even if .env doesn't exist or in production
 *
 * Note: In Deno, we need to manually set environment variables after loading them
 */
export async function loadEnvIfLocal(): Promise<void> {
  // Try .env from current directory first (functions/.env)
  // This is where Supabase Edge Functions expect the .env file
  const possibleEnvFilePaths = [
    ".env", // Current directory (functions/)
    "../.env", // Parent directory
    "../../.env", // database/
    "../../../dashboard/.env.development", // dashboard/.env.development (fallback)
  ];

  let loadedEnv: Record<string, string> | null = null;
  let loadedPath: string | null = null;

  // Try to load .env from various locations
  for (const envPath of possibleEnvFilePaths) {
    try {
      const result = await load({ envPath });
      if (result && Object.keys(result).length > 0) {
        loadedEnv = result;
        loadedPath = envPath;
        console.log(
          `[ENV] Loaded environment from: ${envPath} (${
            Object.keys(result).length
          } vars)`,
        );
        break; // Successfully loaded, stop trying other paths
      }
    } catch (error) {
      // Continue to next path if this one doesn't exist
      if (error instanceof Error && error.message.includes("No such file")) {
        continue;
      }
      // Log other errors but continue
      if (error instanceof Error) {
        console.warn(`[ENV] Error loading from ${envPath}:`, error.message);
      }
    }
  }

  // Manually set environment variables in Deno
  // The dotenv load() function returns an object, but doesn't automatically set Deno.env
  if (loadedEnv && Object.keys(loadedEnv).length > 0) {
    let setCount = 0;
    for (const [key, value] of Object.entries(loadedEnv)) {
      // Always set (override existing) to ensure .env values are used
      const oldValue = Deno.env.get(key);
      Deno.env.set(key, value);
      setCount++;
      // Log important vars for debugging
      if (key === "SKIP_EMAIL_SENDING") {
        console.log(
          `[ENV] Set ${key}=${value} (was: ${oldValue || "undefined"})`,
        );
      }
    }
    console.log(
      `[ENV] Set ${setCount} environment variables from ${loadedPath}`,
    );
    console.log(
      `[ENV] SKIP_EMAIL_SENDING is now: ${Deno.env.get("SKIP_EMAIL_SENDING")}`,
    );
  } else {
    console.log(
      "[ENV] No .env file found or file was empty, using existing environment variables",
    );
    const currentSkip = Deno.env.get("SKIP_EMAIL_SENDING");
    console.log(
      `[ENV] Current SKIP_EMAIL_SENDING value: ${currentSkip || "undefined"}`,
    );
    if (!currentSkip) {
      console.warn(
        "[ENV] WARNING: SKIP_EMAIL_SENDING is not set! Emails will be sent.",
      );
    }
  }
}
