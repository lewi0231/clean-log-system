import { clearEnvCache, getEnv, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Environment Variable Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear the env cache before each test
    clearEnvCache();
  });

  it("should return validated environment variables when all required vars are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const env = getEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
  });

  it("should throw error in development when required vars are missing", () => {
    // Clear cache first
    clearEnvCache();
    // Use Object.defineProperty to override read-only NODE_ENV for testing
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      writable: true,
      configurable: true,
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getEnv()).toThrow("Missing or invalid environment variables");
  });

  it("should accept NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY when anon key is unset", () => {
    clearEnvCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "publishable-fallback";

    const env = getEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("publishable-fallback");
  });

  it("should return defaults in production when vars are missing (graceful degradation)", () => {
    // Clear cache first
    clearEnvCache();
    // Use Object.defineProperty to override read-only NODE_ENV for testing
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    const env = getEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("");
  });

  it("should validate URL format for Supabase URL", () => {
    // Clear cache first
    clearEnvCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-valid-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    expect(() => getEnv()).toThrow();
  });

  it("should return Supabase URL via helper function", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const url = getSupabaseUrl();
    expect(url).toBe("https://test.supabase.co");
  });

  it("should return Supabase anon key via helper function", () => {
    // Clear cache first
    clearEnvCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const key = getSupabaseAnonKey();
    expect(key).toBe("test-key");
  });

  it("should cache validated environment variables", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    const env1 = getEnv();
    const env2 = getEnv();

    // Should return same instance (cached)
    expect(env1).toBe(env2);
  });
});
