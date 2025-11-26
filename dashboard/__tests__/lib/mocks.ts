import { vi } from "vitest";

/**
 * Mock utilities for testing
 */

export const mockSupabase = {
  functions: {
    invoke: vi.fn(),
  },
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
};

export const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

/**
 * Setup mocks before each test
 */
export const setupMocks = () => {
  vi.mock("@/lib/supabase", () => ({
    supabase: mockSupabase,
  }));

  vi.mock("@/lib/logger", () => ({
    log: mockLogger,
  }));
};

/**
 * Reset all mocks
 */
export const resetMocks = () => {
  vi.clearAllMocks();
};
