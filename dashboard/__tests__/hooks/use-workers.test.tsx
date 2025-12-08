import { useWorkers } from "@/hooks/use-workers";
import { WorkersService } from "@/lib/services";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockWorker } from "../lib/fixtures";

vi.mock("@/lib/services", () => ({
  WorkersService: {
    listWorkersAndLocations: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockUseOrganization = vi.hoisted(() =>
  vi.fn(() => ({
    organizationId: "org-1",
    loading: false,
    error: null,
  }))
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
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
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
    vi.mocked(WorkersService.listWorkersAndLocations).mockRejectedValue(
      mockError
    );

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
    vi.mocked(WorkersService.create).mockResolvedValue(mockWorker);

    const { result } = renderHook(() => useWorkers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.createWorker({
      organization_id: "org-1",
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
    });

    expect(WorkersService.create).toHaveBeenCalled();
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(2);
  });

  it("should update worker and refetch", async () => {
    const mockWorker = createMockWorker({ name: "Jane Doe" });
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
      name: "Jane Doe",
    });

    expect(WorkersService.update).toHaveBeenCalled();
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(2);
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
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(2);
  });

  it("should not fetch when organizationId is null", async () => {
    mockUseOrganization.mockReturnValue({
      organizationId: null,
      loading: false,
      error: null,
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
      loading: false,
      error: null,
    });
  });
});
