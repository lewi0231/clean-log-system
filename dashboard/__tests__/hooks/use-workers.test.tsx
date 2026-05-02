import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { WorkersService } from "@/lib/services";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockWorker } from "../lib/fixtures";

const mockSupabase = vi.hoisted(() => {
  const subscribe = vi.fn();
  const on = vi.fn().mockReturnValue({ subscribe });
  const channel = vi.fn().mockReturnValue({ on });
  const removeChannel = vi.fn();
  return { channel, removeChannel };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockSupabase.channel(...args),
    removeChannel: (...args: unknown[]) => mockSupabase.removeChannel(...args),
  },
}));

vi.mock("@/lib/services", () => ({
  WorkersService: {
    listWorkersAndLocations: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

type UseOrganizationReturn = ReturnType<typeof useOrganization>;

const mockUseOrganization = vi.hoisted(() =>
  vi.fn(
    (): UseOrganizationReturn => ({
      organizationId: "org-1",
      organizationUserId: "ou-1",
      userRole: "admin",
      loading: false,
      error: undefined,
    })
  )
);

vi.mock("@/hooks/useOrganization", () => ({
  default: mockUseOrganization,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
}

describe("useWorkers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch workers on mount", async () => {
    const mockWorkers = [createMockWorker()];
    vi.mocked(WorkersService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: mockWorkers,
      locations: [],
    });

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workers).toEqual(mockWorkers);
    expect(result.current.error).toBeNull();
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledWith({
      organization_id: "org-1",
    });
  });

  it("should handle loading state", async () => {
    vi.mocked(WorkersService.listWorkersAndLocations).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              workers: [],
              locations: [],
            });
          }, 100);
        })
    );

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(WorkersService.listWorkersAndLocations).mockRejectedValue(mockError);

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.workers).toEqual([]);
  });

  it("should create worker and refetch", async () => {
    const mockWorker = createMockWorker();
    vi.mocked(WorkersService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: [],
      locations: [],
    });
    vi.mocked(WorkersService.create).mockResolvedValue({
      worker: mockWorker,
      emailSent: true,
    });

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.createWorker({
      organization_id: "org-1",
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "1234567890",
    });

    expect(WorkersService.create).toHaveBeenCalled();
    // Initial mount + invalidateCache (triggers refetch) + explicit refetch = 3 calls
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(3);
  });

  it("should update worker and refetch", async () => {
    const mockWorker = createMockWorker({
      first_name: "Jane",
      last_name: "Doe",
      name: "Jane Doe",
    });
    vi.mocked(WorkersService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: [createMockWorker()],
      locations: [],
    });
    vi.mocked(WorkersService.update).mockResolvedValue(mockWorker);

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.updateWorker({
      id: "worker-1",
      first_name: "Jane",
      last_name: "Doe",
    });

    expect(WorkersService.update).toHaveBeenCalled();
    // Initial mount + invalidateCache (triggers refetch) + explicit refetch = 3 calls
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(3);
  });

  it("should delete worker and refetch", async () => {
    vi.mocked(WorkersService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: [createMockWorker()],
      locations: [],
    });
    vi.mocked(WorkersService.delete).mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.deleteWorker({ id: "worker-1" });

    expect(WorkersService.delete).toHaveBeenCalled();
    // Initial mount + invalidateCache (triggers refetch) + explicit refetch = 3 calls
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(3);
  });

  it("should not fetch when organizationId is null", async () => {
    mockUseOrganization.mockReturnValue({
      organizationId: null,
      organizationUserId: null,
      userRole: null,
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(WorkersService.listWorkersAndLocations).not.toHaveBeenCalled();
    expect(result.current.workers).toEqual([]);

    // Reset for other tests
    mockUseOrganization.mockReturnValue({
      organizationId: "org-1",
      organizationUserId: "ou-1",
      userRole: "admin",
      loading: false,
      error: undefined,
    });
  });
});
