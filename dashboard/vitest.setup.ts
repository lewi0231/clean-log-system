import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";

// Load .env.development file to make environment variables available in tests
// This ensures tests can access STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, etc.
try {
    const envPath = resolve(process.cwd(), ".env.development");
    const envFile = readFileSync(envPath, "utf-8");

    // Parse .env file (simple key=value parser)
    envFile.split("\n").forEach((line) => {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (trimmedLine && !trimmedLine.startsWith("#")) {
            const [key, ...valueParts] = trimmedLine.split("=");
            if (key && valueParts.length > 0) {
                // Join value parts back (in case value contains =)
                const value = valueParts.join("=").trim();
                // Remove quotes if present
                const cleanValue = value.replace(/^["']|["']$/g, "");
                // Only set if not already set (don't override existing env vars)
                if (key && !process.env[key]) {
                    process.env[key] = cleanValue;
                }
            }
        }
    });
} catch (error) {
    // .env.development might not exist, that's okay
    console.warn(
        "Could not load .env.development:",
        error instanceof Error ? error.message : String(error),
    );
}

// Mock Supabase before any imports
vi.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
        auth: {
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(),
                })),
            })),
        })),
    },
}));
