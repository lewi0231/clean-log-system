/**
 * Environment variable validation
 * Validates required environment variables at runtime
 */

import { z } from "zod";

const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Get validated environment variables
 * Throws error in development if required vars are missing
 * Returns validated env object
 */
export function getEnv(): Env {
    if (validatedEnv) {
        return validatedEnv;
    }

    const rawEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    };

    const result = envSchema.safeParse(rawEnv);

    if (!result.success) {
        const errors = result.error.issues
            .map((err) => {
                const path = err.path.map(String).join(".");
                return `${path}: ${err.message}`;
            })
            .join("\n");

        const errorMessage =
            `Missing or invalid environment variables:\n${errors}\n\nPlease check your .env.local file.`;

        if (process.env.NODE_ENV === "production") {
            // In production, log error but don't throw to prevent app crash
            console.error("[ENV] Environment validation failed:", errorMessage);
            // Return defaults to allow graceful degradation
            validatedEnv = {
                NEXT_PUBLIC_SUPABASE_URL: rawEnv.NEXT_PUBLIC_SUPABASE_URL || "",
                NEXT_PUBLIC_SUPABASE_ANON_KEY:
                    rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
                    rawEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
                NEXT_PUBLIC_APP_URL: rawEnv.NEXT_PUBLIC_APP_URL,
            };
            return validatedEnv;
        } else {
            // In development, throw to fail fast
            throw new Error(errorMessage);
        }
    }

    validatedEnv = result.data;
    return validatedEnv;
}

/**
 * Get Supabase URL with validation
 */
export function getSupabaseUrl(): string {
    const env = getEnv();
    return env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Get Supabase anon key with validation
 */
export function getSupabaseAnonKey(): string {
    const env = getEnv();
    return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
