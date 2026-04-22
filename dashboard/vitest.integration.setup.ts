import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.development so integration tests can access local Supabase + Stripe keys.
// Note: Unlike unit tests, integration tests must NOT mock Supabase.
try {
  const envPath = resolve(process.cwd(), ".env.development");
  const envFile = readFileSync(envPath, "utf-8");

  envFile.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, ...valueParts] = trimmedLine.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        const cleanValue = value.replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = cleanValue;
        }
      }
    }
  });
} catch (error) {
  // .env.development might not exist, that's okay
  // (tests that require these env vars will throw a helpful error)
  console.warn(
    "Could not load .env.development:",
    error instanceof Error ? error.message : String(error)
  );
}

// Safety defaults for integration tests: avoid sending real emails.
// We intentionally override any .env.development values for these flags.
process.env.RESEND_TEST_MODE = "true";
process.env.SKIP_EMAIL_SENDING = "true";
