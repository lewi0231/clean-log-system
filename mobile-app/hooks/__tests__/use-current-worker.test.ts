import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCurrentWorker } from "../use-current-worker";

vi.mock("@/lib/invoke-authed-function", () => ({
  invokeAuthedFunction: vi.fn(),
}));

vi.mock("../useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../useOrganization", () => ({
  useOrganization: vi.fn(),
}));

const { invokeAuthedFunction } = await import("@/lib/invoke-authed-function");
const { useAuth } = await import("../useAuth");
const { useOrganization } = await import("../useOrganization");

const mockSession = {
  access_token: "test-access-token",
} as const;

describe("useCurrentWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when user is not authenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-123",
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useCurrentWorker());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worker).toBe(null);
  });

  it("should return null when organization ID is missing", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "user-123",
        email: "test@example.com",
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
      session: mockSession,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: null,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useCurrentWorker());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worker).toBe(null);
  });

  it("should fetch and return current worker", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      aud: "authenticated" as const,
      created_at: new Date().toISOString(),
    };

    const mockWorker = {
      id: "worker-123",
      name: "John Doe",
      auth_user_id: "user-123",
      active: true,
      organization_id: "org-123",
      email: "test@example.com",
      phone: "1234567890",
      created_at: new Date().toISOString(),
    };

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-123",
      loading: false,
      error: null,
    });
    vi.mocked(invokeAuthedFunction).mockResolvedValue({
      data: {
        workers: [mockWorker],
      },
      error: null,
    });

    const { result } = renderHook(() => useCurrentWorker());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worker).toEqual(mockWorker);
    expect(invokeAuthedFunction).toHaveBeenCalledWith("list-workers", mockSession.access_token, {
      body: { organization_id: "org-123" },
    });
  });

  it("should filter out inactive workers", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      aud: "authenticated" as const,
      created_at: new Date().toISOString(),
    };

    const inactiveWorker = {
      id: "worker-123",
      name: "John Doe",
      auth_user_id: "user-123",
      active: false,
      organization_id: "org-123",
      email: "test@example.com",
      phone: "1234567890",
      created_at: new Date().toISOString(),
    };

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-123",
      loading: false,
      error: null,
    });
    vi.mocked(invokeAuthedFunction).mockResolvedValue({
      data: {
        workers: [inactiveWorker],
      },
      error: null,
    });

    const { result } = renderHook(() => useCurrentWorker());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worker).toBe(null);
  });

  it("should handle API errors gracefully", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      aud: "authenticated" as const,
      created_at: new Date().toISOString(),
    };

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-123",
      loading: false,
      error: null,
    });
    vi.mocked(invokeAuthedFunction).mockResolvedValue({
      data: null,
      error: { message: "Network error" },
    });

    const { result } = renderHook(() => useCurrentWorker());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worker).toBe(null);
  });

  it("should handle multiple workers and find correct one", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      aud: "authenticated" as const,
      created_at: new Date().toISOString(),
    };

    const workers = [
      {
        id: "worker-1",
        name: "Alice",
        auth_user_id: "user-456",
        active: true,
        organization_id: "org-123",
        email: "alice@example.com",
        phone: "1111111111",
        created_at: new Date().toISOString(),
      },
      {
        id: "worker-2",
        name: "Bob",
        auth_user_id: "user-123",
        active: true,
        organization_id: "org-123",
        email: "test@example.com",
        phone: "2222222222",
        created_at: new Date().toISOString(),
      },
      {
        id: "worker-3",
        name: "Charlie",
        auth_user_id: "user-789",
        active: true,
        organization_id: "org-123",
        email: "charlie@example.com",
        phone: "3333333333",
        created_at: new Date().toISOString(),
      },
    ];

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-123",
      loading: false,
      error: null,
    });
    vi.mocked(invokeAuthedFunction).mockResolvedValue({
      data: { workers },
      error: null,
    });

    const { result } = renderHook(() => useCurrentWorker());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.worker).toEqual(workers[1]);
  });
});
