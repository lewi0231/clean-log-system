// Environment utilities for Edge Functions
// Handles conditional dotenv loading for local development

import { load } from "dotenv";
import { createLoggerWithoutRequest } from "./logger.ts";

/**
 * Load environment variables from .env file if available (local development)
 * Edge Functions run from database/supabase/functions/, so .env should be in current directory
 * Safe to call even if .env doesn't exist or in production
 *
 * Note: In Deno, we need to manually set environment variables after loading them
 */
export async function loadEnvIfLocal(): Promise<void> {
  const logger = createLoggerWithoutRequest({ functionName: "loadEnvIfLocal" });
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
        logger.info("Loaded environment file", {
          path: envPath,
          varCount: Object.keys(result).length,
        });
        break; // Successfully loaded, stop trying other paths
      }
    } catch (error) {
      // Continue to next path if this one doesn't exist
      if (error instanceof Error && error.message.includes("No such file")) {
        continue;
      }
      // Log other errors but continue
      if (error instanceof Error) {
        logger.warn("Error loading environment file", {
          path: envPath,
          error: error.message,
        });
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
      // Avoid logging values; only log safe booleans for known flags
      if (key === "SKIP_EMAIL_SENDING") {
        logger.debug("Applied SKIP_EMAIL_SENDING from env file", {
          willSkip: value === "true",
          wasSet: oldValue !== undefined,
        });
      }
    }
    logger.info("Applied environment variables from file", {
      path: loadedPath,
      setCount,
    });
  } else {
    logger.info(
      "No .env file found or file was empty; using existing environment variables",
    );
    const currentSkip = Deno.env.get("SKIP_EMAIL_SENDING");
    logger.debug("Current SKIP_EMAIL_SENDING", {
      isSet: Boolean(currentSkip),
      willSkip: currentSkip === "true",
    });
    if (!currentSkip) {
      logger.warn("SKIP_EMAIL_SENDING is not set; emails may be sent");
    }
  }
}
