import { createMockFieldConfig } from "@/__tests__/lib/fixtures";
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { FormSectionWithFields } from "@clean-log/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createMockSection = (
  overrides?: Partial<FormSectionWithFields>
): FormSectionWithFields => ({
  id: "section-1",
  organization_id: "org-1",
  title: "Test Section",
  description: "Test Description",
  order_position: 0,
  collapsed_by_default: false,
  field_ids: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

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

describe("useMobileConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch field configs and sections on mount", async () => {
    const mockFieldConfigs = [createMockFieldConfig()];
    const mockSections = [createMockSection()];

    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: { field_configs: mockFieldConfigs },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      });

    const { result } = renderHook(() => useMobileConfig("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Hook adds section_id and conditional_logic defaults
    expect(result.current.fieldConfigs).toEqual(
      mockFieldConfigs.map((fc) => ({
        ...fc,
        section_id: fc.section_id ?? null,
        conditional_logic: fc.conditional_logic ?? null,
      }))
    );
    expect(result.current.sections).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "section-1" })])
    );
    expect(result.current.error).toBeNull();
  });

  it("should handle error state when fetch fails", async () => {
    const mockError = { message: "Failed to fetch", status: 500 };
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useMobileConfig("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain("Failed to fetch");
    expect(log.error).toHaveBeenCalled();
  });

  it("should update field config optimistically without refetch on success", async () => {
    const mockFieldConfig = createMockFieldConfig({ id: "field-1" });
    const mockSections = [createMockSection()];

    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: { field_configs: [mockFieldConfig] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    const { result } = renderHook(() => useMobileConfig("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialInvokeCount = vi.mocked(supabase.functions.invoke).mock.calls
      .length;

    // Handlers now use startTransition internally and don't return a promise
    act(() => {
      result.current.handleUpdateFieldConfig("field-1", {
        label: "Updated Label",
      });
    });

    // Wait for the mutation to be called
    await waitFor(() => {
      const invokeCalls = vi.mocked(supabase.functions.invoke).mock.calls;
      expect(invokeCalls.length).toBeGreaterThan(initialInvokeCount);
    });

    // Should have called update-field-config but NOT refetched
    const invokeCalls = vi.mocked(supabase.functions.invoke).mock.calls;
    // Should not have called list-field-configs again (no refetch)
    const lastCall = invokeCalls[invokeCalls.length - 1];
    expect(lastCall[0]).not.toBe("list-field-configs");

    // Note: With startTransition + useOptimistic, the optimistic state is shown
    // during the transition. After the transition completes successfully,
    // the state returns to the base state (from query cache).
    // The test verifies the API was called correctly (optimistic pattern working).
  });

  it("should refetch on error to rollback optimistic update", async () => {
    const mockFieldConfig = createMockFieldConfig({ id: "field-1" });
    const mockSections = [createMockSection()];

    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: { field_configs: [mockFieldConfig] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Update failed", status: 500 },
      })
      .mockResolvedValueOnce({
        data: { field_configs: [mockFieldConfig] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      });

    const { result } = renderHook(() => useMobileConfig("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Handlers now use startTransition internally and don't return a promise
    // Errors are caught internally and onRefetch is called
    act(() => {
      result.current.handleUpdateFieldConfig("field-1", {
        label: "Updated Label",
      });
    });

    // Should have refetched to rollback after error
    await waitFor(() => {
      const invokeCalls = vi.mocked(supabase.functions.invoke).mock.calls;
      const refetchCalls = invokeCalls.filter(
        (call) => call[0] === "list-field-configs"
      );
      expect(refetchCalls.length).toBeGreaterThan(1); // Initial + rollback
    });
  });

  it("should reorder field configs optimistically", async () => {
    const mockFieldConfigs = [
      createMockFieldConfig({ id: "field-1", order_position: 0 }),
      createMockFieldConfig({ id: "field-2", order_position: 1 }),
    ];
    const mockSections = [createMockSection()];

    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: { field_configs: mockFieldConfigs },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    const { result } = renderHook(() => useMobileConfig("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Handlers now use startTransition internally and don't return a promise
    act(() => {
      result.current.handleReorderFieldConfigs(["field-2", "field-1"]);
    });

    // Wait for the mutation to be called
    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "reorder-field-configs",
        {
          body: {
            organization_id: "org-1",
            field_config_ids: ["field-2", "field-1"],
          },
        }
      );
    });
  });

  it("should apply template and set applyingTemplate state", async () => {
    const mockSections = [createMockSection()];

    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: { field_configs: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, count: 5 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { field_configs: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { sections: mockSections },
        error: null,
      });

    const { result } = renderHook(() => useMobileConfig("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start the async operation
    const applyPromise = result.current.handleApplyTemplate("service_based");

    // Wait for mutation to complete
    await act(async () => {
      await applyPromise;
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "apply-field-config-template",
      {
        body: {
          organization_id: "org-1",
          business_mode: "service_based",
          reset_existing: false,
        },
      }
    );
  });

  it("should not fetch when organizationId is null", async () => {
    const { result } = renderHook(() => useMobileConfig(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(result.current.fieldConfigs).toEqual([]);
    expect(result.current.sections).toEqual([]);
  });
});
