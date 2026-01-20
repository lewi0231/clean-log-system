import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Mock expo-router
vi.mock("expo-router", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

const { supabase } = await import("@/lib/supabase");

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", () => {
    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
  });

  it("should set user when session exists", async () => {
    const mockUser = {
      id: "test-user-id",
      email: "test@example.com",
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: mockUser,
          access_token: "test-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          refresh_token: "test-refresh",
        },
      },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it("should handle auth state changes", async () => {
    const mockUser = {
      id: "test-user-id",
      email: "test@example.com",
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const subscription = { unsubscribe: vi.fn() };
    let authCallback: (event: string, session: any) => void;

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
      (callback) => {
        authCallback = callback;
        return { data: { subscription } };
      }
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBe(null);

    // Trigger SIGNED_IN event
    authCallback("SIGNED_IN", {
      user: mockUser,
      access_token: "test-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      refresh_token: "test-refresh",
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });
  });

  it("should handle sign out", async () => {
    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signOut();

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("should unsubscribe on unmount", async () => {
    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });

    const { unmount } = renderHook(() => useAuth());

    await waitFor(() => {});

    unmount();

    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
