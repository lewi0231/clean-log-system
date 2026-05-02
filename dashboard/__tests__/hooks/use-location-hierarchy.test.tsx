import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import useOrganization from "@/hooks/useOrganization";
import { LocationHierarchyService } from "@/lib/services";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLocationHierarchyNode } from "../lib/fixtures";

vi.mock("@/lib/services", () => ({
  LocationHierarchyService: {
    list: vi.fn(),
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
      organizationUserId: null,
      userRole: null,
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

describe("useLocationHierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch hierarchy nodes on mount", async () => {
    const mockNodes = [createMockLocationHierarchyNode()];
    vi.mocked(LocationHierarchyService.list).mockResolvedValue({
      nodes: mockNodes,
    });

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.nodes).toEqual(mockNodes);
    expect(result.current.error).toBeNull();
    expect(LocationHierarchyService.list).toHaveBeenCalledWith({
      organization_id: "org-1",
    });
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(LocationHierarchyService.list).mockRejectedValue(mockError);

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.nodes).toEqual([]);
  });

  it("should create node and refetch", async () => {
    const mockNode = createMockLocationHierarchyNode();
    vi.mocked(LocationHierarchyService.list).mockResolvedValue({
      nodes: [],
    });
    vi.mocked(LocationHierarchyService.create).mockResolvedValue(mockNode);

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.createNode({
      name: "New Company",
      type: "company",
    });

    expect(LocationHierarchyService.create).toHaveBeenCalledWith({
      organization_id: "org-1",
      name: "New Company",
      type: "company",
    });
  });

  it("should update node and refetch", async () => {
    const mockNode = createMockLocationHierarchyNode({ name: "Updated Name" });
    vi.mocked(LocationHierarchyService.list).mockResolvedValue({
      nodes: [createMockLocationHierarchyNode()],
    });
    vi.mocked(LocationHierarchyService.update).mockResolvedValue(mockNode);

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.updateNode({
      id: "node-1",
      name: "Updated Name",
    });

    expect(LocationHierarchyService.update).toHaveBeenCalled();
    const callArgs = vi.mocked(LocationHierarchyService.update).mock.calls[0][0];
    expect(callArgs).toMatchObject({
      id: "node-1",
      name: "Updated Name",
    });
  });

  it("should delete node and refetch", async () => {
    vi.mocked(LocationHierarchyService.list).mockResolvedValue({
      nodes: [createMockLocationHierarchyNode()],
    });
    vi.mocked(LocationHierarchyService.delete).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.deleteNode("node-1");

    expect(LocationHierarchyService.delete).toHaveBeenCalledWith({
      id: "node-1",
    });
  });

  it("should handle network errors", async () => {
    const networkError = new Error("Network request failed");
    vi.mocked(LocationHierarchyService.list).mockRejectedValue(networkError);

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network request failed");
  });

  it("should handle validation errors on create", async () => {
    vi.mocked(LocationHierarchyService.list).mockResolvedValue({
      nodes: [],
    });
    const validationError = new Error("Name is required");
    vi.mocked(LocationHierarchyService.create).mockRejectedValue(validationError);

    const { result } = renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      result.current.createNode({
        name: "",
        type: "company",
      })
    ).rejects.toThrow("Name is required");
  });

  it("should not fetch when organizationId is missing", () => {
    mockUseOrganization.mockReturnValue({
      organizationId: null,
      organizationUserId: null,
      userRole: null,
      loading: false,
      error: undefined,
    });

    renderHook(() => useLocationHierarchy(), {
      wrapper: createWrapper(),
    });

    expect(LocationHierarchyService.list).not.toHaveBeenCalled();
  });
});
