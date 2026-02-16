import { useLocations } from "@/hooks/use-locations";
import { LocationsService, WorkersService } from "@/lib/services";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLocation } from "../lib/fixtures";

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
  LocationsService: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  WorkersService: {
    listWorkersAndLocations: vi.fn(),
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

describe("useLocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch locations on mount", async () => {
    const mockLocations = [createMockLocation()];
    vi.mocked(WorkersService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: [],
      locations: mockLocations,
    });

    const { result } = renderHook(() => useLocations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.locations).toEqual(mockLocations);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(WorkersService.listWorkersAndLocations).mockRejectedValue(
      mockError
    );

    const { result } = renderHook(() => useLocations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.locations).toEqual([]);
  });

  it("should create location with optimistic update", async () => {
    const mockLocation = createMockLocation();
    vi.mocked(WorkersService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: [],
      locations: [],
    });
    vi.mocked(LocationsService.create).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockLocation), 50))
    );

    const { result } = renderHook(() => useLocations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const createPromise = result.current.createLocation({
      organization_id: "org-1",
      name: "Main Office",
      email: "office@example.com",
      address: "123 Main St",
      contact_person: "John Doe",
    });

    // Optimistic update: new location appears immediately (before server responds)
    await waitFor(() => {
      expect(result.current.locations).toHaveLength(1);
      expect(result.current.locations[0]?.name).toBe("Main Office");
      expect(result.current.locations[0]?.email).toBe("office@example.com");
    });

    await createPromise;

    expect(LocationsService.create).toHaveBeenCalled();
    // Initial mount + onSettled invalidate (triggers refetch) = 2 calls
    expect(WorkersService.listWorkersAndLocations).toHaveBeenCalledTimes(2);
  });
});
