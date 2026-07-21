import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../useAuth";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("@/lib/purge-stale-supabase-auth-storage", () => ({
  purgeStaleSupabaseAuthStorage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

const { supabase } = await import("@/lib/supabase");

function createWrapper() {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(AuthProvider, null, children);
  }
  Wrapper.displayName = "AuthTestWrapper";
  return Wrapper;
}

function mockInitialAuthState(
  session: {
    user: { id: string; email: string; aud: string; created_at: string };
    access_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number;
    refresh_token: string;
  } | null
) {
  const subscription = { unsubscribe: vi.fn() };
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: session as never },
    error: null,
  });
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
    queueMicrotask(() => callback("INITIAL_SESSION", session));
    return { data: { subscription } };
  });
  return subscription;
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("should initialize with loading state", () => {
    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

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

    mockInitialAuthState({
      user: mockUser,
      access_token: "test-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      refresh_token: "test-refresh",
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

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
    let authCallback: (event: string, session: unknown) => void;

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authCallback = callback;
      queueMicrotask(() => callback("INITIAL_SESSION", null));
      return { data: { subscription } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBe(null);

    authCallback!("SIGNED_IN", {
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
    mockInitialAuthState(null);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signOut();

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("should unsubscribe on unmount", async () => {
    const subscription = mockInitialAuthState(null);

    const { unmount } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {});

    unmount();

    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it("clears local session on invalid refresh token from getSession", async () => {
    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: {
        name: "AuthApiError",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      } as never,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not clear session on unrelated getSession AuthApiError", async () => {
    const mockUser = {
      id: "test-user-id",
      email: "test@example.com",
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    const session = {
      user: mockUser,
      access_token: "test-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      refresh_token: "test-refresh",
    };

    const subscription = { unsubscribe: vi.fn() };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: session as never },
      error: {
        name: "AuthApiError",
        message: "Email not confirmed",
        status: 400,
      } as never,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
