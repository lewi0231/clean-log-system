import { createMockFieldConfig } from "@/__tests__/lib/fixtures";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { FieldConfigsService } from "@/lib/services";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services", () => ({
  FieldConfigsService: {
    list: vi.fn(),
  },
}));

const mockUseOrganization = vi.hoisted(() =>
  vi.fn((): { organizationId: string | null; loading: boolean; error: string | null } => ({
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
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useFieldConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrganization.mockReturnValue({
      organizationId: "org-1",
      loading: false,
      error: null,
    });
  });

  it("should fetch field configs on mount", async () => {
    const mockFieldConfigs = [createMockFieldConfig()];
    vi.mocked(FieldConfigsService.list).mockResolvedValue(mockFieldConfigs);

    const { result } = renderHook(() => useFieldConfigs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fieldConfigs).toEqual(mockFieldConfigs);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(FieldConfigsService.list).mockRejectedValue(mockError);

    const { result } = renderHook(() => useFieldConfigs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.fieldConfigs).toEqual([]);
  });

  it("should refetch field configs", async () => {
    vi.mocked(FieldConfigsService.list).mockResolvedValue([]);

    const { result } = renderHook(() => useFieldConfigs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(FieldConfigsService.list).toHaveBeenCalledTimes(2);
  });

  it("serves cached data without a loading flash on remount", async () => {
    const mockFieldConfigs = [createMockFieldConfig()];
    vi.mocked(FieldConfigsService.list).mockResolvedValue(mockFieldConfigs);

    const wrapper = createWrapper();
    const first = renderHook(() => useFieldConfigs(), { wrapper });
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    expect(FieldConfigsService.list).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useFieldConfigs(), { wrapper });
    // Cache hit: not pending, data already available
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.fieldConfigs).toEqual(mockFieldConfigs);
  });

  it("does not stay loading when organizationId is missing", async () => {
    mockUseOrganization.mockReturnValue({
      organizationId: null,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useFieldConfigs(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(false);
    expect(result.current.fieldConfigs).toEqual([]);
    expect(FieldConfigsService.list).not.toHaveBeenCalled();
  });
});
