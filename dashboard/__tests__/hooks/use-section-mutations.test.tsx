import { useSectionMutations } from "@/hooks/use-section-mutations";
import { supabase } from "@/lib/supabase";
import type { FormSectionWithFields } from "@clean-log/shared";
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

describe("useSectionMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should optimistically add section", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useSectionMutations({
          organizationId: "org-1",
          sections: [],
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleAdd({
        title: "New Section",
        description: "Description",
        order_position: 0,
        collapsed_by_default: false,
        field_ids: [],
      });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "create-form-section",
      expect.objectContaining({
        body: expect.objectContaining({
          title: "New Section",
          organization_id: "org-1",
        }),
      })
    );
  });

  it("should optimistically update section", async () => {
    const existingSection = createMockSection({
      id: "section-1",
      title: "Original Title",
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useSectionMutations({
          organizationId: "org-1",
          sections: [existingSection],
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleUpdate("section-1", {
        title: "Updated Title",
      });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "update-form-section",
      expect.objectContaining({
        body: expect.objectContaining({
          id: "section-1",
          title: "Updated Title",
        }),
      })
    );
  });

  it("should optimistically delete section", async () => {
    const existingSection = createMockSection({ id: "section-1" });

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useSectionMutations({
          organizationId: "org-1",
          sections: [existingSection],
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleDelete("section-1");
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "delete-form-section",
      expect.objectContaining({
        body: { id: "section-1" },
      })
    );
  });

  it("should reorder sections", async () => {
    const sections = [
      createMockSection({ id: "section-1", order_position: 0 }),
      createMockSection({ id: "section-2", order_position: 1 }),
    ];

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useSectionMutations({
          organizationId: "org-1",
          sections,
          onRefetch: async () => {},
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleReorder(["section-2", "section-1"]);
    });

    // Should call update-form-section for each section with new order
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "update-form-section",
      expect.objectContaining({
        body: expect.objectContaining({
          id: "section-2",
          order_position: 0,
        }),
      })
    );
  });

  it("should call onRefetch on error", async () => {
    const existingSection = createMockSection({ id: "section-1" });
    const onRefetch = vi.fn().mockResolvedValue(undefined);

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Update failed", status: 500 },
    });

    const { result } = renderHook(
      () =>
        useSectionMutations({
          organizationId: "org-1",
          sections: [existingSection],
          onRefetch,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await expect(
        result.current.handleUpdate("section-1", {
          title: "Updated",
        })
      ).rejects.toBeDefined();
    });

    expect(onRefetch).toHaveBeenCalled();
  });
});
