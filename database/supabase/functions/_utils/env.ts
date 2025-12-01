// Environment utilities for Edge Functions
// Handles conditional dotenv loading for local development

import { load } from "dotenv";

/**
 * Load environment variables from .env file if available (local development)
 * Safe to call even if .env doesn't exist or in production
 */
export async function loadEnvIfLocal(): Promise<void> {
  try {
    await load({ export: true });
  } catch (error) {
    // Silently ignore if .env doesn't exist (expected in production)
    if (error instanceof Error && !error.message.includes("No such file")) {
      console.warn("Error loading .env file:", error);
    }
  }
}
