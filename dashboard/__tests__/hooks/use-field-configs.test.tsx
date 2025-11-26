import { createMockFieldConfig } from "@/__tests__/lib/fixtures";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { FieldConfigsService } from "@/lib/services";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services", () => ({
  FieldConfigsService: {
    list: vi.fn(),
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

describe("useFieldConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch field configs on mount", async () => {
    const mockFieldConfigs = [createMockFieldConfig()];
    vi.mocked(FieldConfigsService.list).mockResolvedValue(mockFieldConfigs);

    const { result } = renderHook(() => useFieldConfigs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fieldConfigs).toEqual(mockFieldConfigs);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(FieldConfigsService.list).mockRejectedValue(mockError);

    const { result } = renderHook(() => useFieldConfigs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch");
    expect(result.current.fieldConfigs).toEqual([]);
  });

  it("should refetch field configs", async () => {
    vi.mocked(FieldConfigsService.list).mockResolvedValue([]);

    const { result } = renderHook(() => useFieldConfigs());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(FieldConfigsService.list).toHaveBeenCalledTimes(2);
  });
});
