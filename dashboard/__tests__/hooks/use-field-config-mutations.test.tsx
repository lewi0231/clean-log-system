import { createMockFieldConfig } from "@/__tests__/lib/fixtures";
import { useFieldConfigMutations } from "@/hooks/use-field-config-mutations";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
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

describe("useFieldConfigMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should optimistically add field config", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useFieldConfigMutations({
          organizationId: "org-1",
          fieldConfigs: [],
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    let promise: Promise<void>;
    act(() => {
      promise = result.current.handleAdd({
        name: "test_field",
        label: "Test Field",
        field_type: "text",
        description: null,
        required: false,
        validation_rules: null,
        options: null,
        mutually_exclusive_group: null,
        group_cluster: null,
        section_id: null,
        conditional_logic: null,
        order_position: 0,
      });
    });

    // Wait for the mutation to complete
    await act(async () => {
      await promise!;
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "create-field-config",
      expect.objectContaining({
        body: expect.objectContaining({
          name: "test_field",
          organization_id: "org-1",
        }),
      })
    );
  });

  it("should optimistically update field config", async () => {
    const existingConfig = createMockFieldConfig({
      id: "field-1",
      label: "Original Label",
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useFieldConfigMutations({
          organizationId: "org-1",
          fieldConfigs: [existingConfig],
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    let promise: Promise<void>;
    act(() => {
      promise = result.current.handleUpdate("field-1", {
        label: "Updated Label",
      });
    });

    // Wait for the mutation to complete
    await act(async () => {
      await promise!;
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "update-field-config",
      expect.objectContaining({
        body: expect.objectContaining({
          id: "field-1",
          label: "Updated Label",
        }),
      })
    );
  });

  it("should optimistically delete field config", async () => {
    const existingConfig = createMockFieldConfig({ id: "field-1" });

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useFieldConfigMutations({
          organizationId: "org-1",
          fieldConfigs: [existingConfig],
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    let promise: Promise<void>;
    act(() => {
      promise = result.current.handleDelete("field-1");
    });

    // Wait for the mutation to complete
    await act(async () => {
      await promise!;
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "delete-field-config",
      expect.objectContaining({
        body: { id: "field-1" },
      })
    );
  });

  it.skip("should optimistically reorder field configs", async () => {
    const configs = [
      createMockFieldConfig({ id: "field-1", order_position: 0 }),
      createMockFieldConfig({ id: "field-2", order_position: 1 }),
    ];

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useFieldConfigMutations({
          organizationId: "org-1",
          fieldConfigs: configs,
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleReorder(["field-2", "field-1"]);
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "reorder-field-configs",
      expect.objectContaining({
        body: expect.objectContaining({
          field_config_ids: ["field-2", "field-1"],
        }),
      })
    );
  });

  it("should call onRefetch on error", async () => {
    const existingConfig = createMockFieldConfig({ id: "field-1" });
    const onRefetch = vi.fn().mockResolvedValue(undefined);

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Update failed", status: 500 },
    });

    const { result } = renderHook(
      () =>
        useFieldConfigMutations({
          organizationId: "org-1",
          fieldConfigs: [existingConfig],
          onRefetch,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await expect(
        result.current.handleUpdate("field-1", {
          label: "Updated",
        })
      ).rejects.toBeDefined();
    });

    expect(onRefetch).toHaveBeenCalled();
  });
});
