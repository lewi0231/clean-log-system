import { useLocations } from "@/hooks/use-locations";
import { LocationsService } from "@/lib/services";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLocation } from "../lib/fixtures";

vi.mock("@/lib/services", () => ({
  LocationsService: {
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

describe("useLocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch locations on mount", async () => {
    const mockLocations = [createMockLocation()];
    vi.mocked(LocationsService.listWorkersAndLocations).mockResolvedValue({
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
    vi.mocked(LocationsService.listWorkersAndLocations).mockRejectedValue(
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

  it("should create location and refetch", async () => {
    const mockLocation = createMockLocation();
    vi.mocked(LocationsService.listWorkersAndLocations).mockResolvedValue({
      success: true,
      workers: [],
      locations: [],
    });
    vi.mocked(LocationsService.create).mockResolvedValue(mockLocation);

    const { result } = renderHook(() => useLocations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.createLocation({
      organization_id: "org-1",
      name: "Main Office",
      email: "office@example.com",
      address: "123 Main St",
      contact_person: "John Doe",
    });

    expect(LocationsService.create).toHaveBeenCalled();
    expect(LocationsService.listWorkersAndLocations).toHaveBeenCalledTimes(2);
  });
});
