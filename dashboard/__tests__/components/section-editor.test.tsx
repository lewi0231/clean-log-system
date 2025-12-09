import { createMockFieldConfig } from "@/__tests__/lib/fixtures";
import { SectionEditor } from "@/components/form-builder/section-editor";
import type { FormSectionWithFields } from "@clean-log/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => {
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
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

describe("SectionEditor", () => {
  const mockOnAddSection = vi.fn();
  const mockOnUpdateSection = vi.fn();
  const mockOnDeleteSection = vi.fn();
  const mockOnReorderSections = vi.fn();
  const mockOnDropFieldToSection = vi.fn();
  const mockOnRemoveFieldFromSection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render sections with field counts", () => {
    const sections = [
      createMockSection({ id: "section-1", field_ids: ["field-1", "field-2"] }),
    ];
    const fields = [
      createMockFieldConfig({ id: "field-1", label: "Field 1" }),
      createMockFieldConfig({ id: "field-2", label: "Field 2" }),
    ];

    render(
      <SectionEditor
        sections={sections}
        fields={fields}
        onAddSection={mockOnAddSection}
        onUpdateSection={mockOnUpdateSection}
        onDeleteSection={mockOnDeleteSection}
        onReorderSections={mockOnReorderSections}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.getByText("2 fields")).toBeInTheDocument();
  });

  it("should display fields within sections when expanded", () => {
    const sections = [
      createMockSection({ id: "section-1", field_ids: ["field-1"] }),
    ];
    const fields = [
      createMockFieldConfig({ id: "field-1", label: "Test Field" }),
    ];

    render(
      <SectionEditor
        sections={sections}
        fields={fields}
        onAddSection={mockOnAddSection}
        onUpdateSection={mockOnUpdateSection}
        onDeleteSection={mockOnDeleteSection}
        onReorderSections={mockOnReorderSections}
      />,
      { wrapper: createWrapper() }
    );

    // Section should be expanded by default
    expect(screen.getByText("Test Field")).toBeInTheDocument();
  });

  it("should call onRemoveFieldFromSection when remove button is clicked", async () => {
    const sections = [
      createMockSection({ id: "section-1", field_ids: ["field-1"] }),
    ];
    const fields = [
      createMockFieldConfig({ id: "field-1", label: "Test Field" }),
    ];

    render(
      <SectionEditor
        sections={sections}
        fields={fields}
        onAddSection={mockOnAddSection}
        onUpdateSection={mockOnUpdateSection}
        onDeleteSection={mockOnDeleteSection}
        onReorderSections={mockOnReorderSections}
        onRemoveFieldFromSection={mockOnRemoveFieldFromSection}
      />,
      { wrapper: createWrapper() }
    );

    // Find the field row container
    const fieldLabel = screen.getByText("Test Field");
    const fieldRow = fieldLabel.closest(".group");

    expect(fieldRow).toBeInTheDocument();

    // Hover to show remove button (opacity-0 -> opacity-100 on group-hover)
    if (fieldRow) {
      fireEvent.mouseEnter(fieldRow);
    }

    // Find the remove button within the field row by looking for the destructive button
    // The button has text-destructive class and contains a Trash2 icon
    await waitFor(() => {
      const allButtons = screen.getAllByRole("button");
      const removeButton = allButtons.find((btn) => {
        // Check if button is within the field row and has destructive styling
        const isInFieldRow = fieldRow?.contains(btn);
        const hasDestructiveClass = btn.className.includes("text-destructive");
        return isInFieldRow && hasDestructiveClass;
      });

      expect(removeButton).toBeInTheDocument();

      if (removeButton) {
        fireEvent.click(removeButton);
        expect(mockOnRemoveFieldFromSection).toHaveBeenCalledWith("field-1");
      }
    });
  });

  it("should call onDropFieldToSection when field is dropped", () => {
    const sections = [createMockSection({ id: "section-1", field_ids: [] })];
    const fields = [createMockFieldConfig({ id: "field-1" })];

    render(
      <SectionEditor
        sections={sections}
        fields={fields}
        onAddSection={mockOnAddSection}
        onUpdateSection={mockOnUpdateSection}
        onDeleteSection={mockOnDeleteSection}
        onReorderSections={mockOnReorderSections}
        draggedFieldId="field-1"
        onDropFieldToSection={mockOnDropFieldToSection}
      />,
      { wrapper: createWrapper() }
    );

    const dropZone = screen.getByText(
      "Drag fields here to add to this section"
    );

    fireEvent.dragOver(dropZone, { preventDefault: vi.fn() });
    fireEvent.drop(dropZone, { preventDefault: vi.fn() });

    expect(mockOnDropFieldToSection).toHaveBeenCalledWith(
      "section-1",
      "field-1"
    );
  });

  it("should show empty state when no sections exist", () => {
    render(
      <SectionEditor
        sections={[]}
        fields={[]}
        onAddSection={mockOnAddSection}
        onUpdateSection={mockOnUpdateSection}
        onDeleteSection={mockOnDeleteSection}
        onReorderSections={mockOnReorderSections}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("No sections yet")).toBeInTheDocument();
  });

  it("shows mutually exclusive metadata for section fields", () => {
    const sections = [
      createMockSection({ id: "section-1", field_ids: ["field-1"] }),
    ];
    const fields = [
      createMockFieldConfig({
        id: "field-1",
        label: "Cars Soaped",
        mutually_exclusive_group: "yard_tracking_method",
        group_cluster: "detailed_tracking",
      }),
    ];

    render(
      <SectionEditor
        sections={sections}
        fields={fields}
        onAddSection={mockOnAddSection}
        onUpdateSection={mockOnUpdateSection}
        onDeleteSection={mockOnDeleteSection}
        onReorderSections={mockOnReorderSections}
      />,
      { wrapper: createWrapper() }
    );

    expect(
      screen.getByText("Exclusive: yard_tracking_method")
    ).toBeInTheDocument();
    expect(screen.getByText("Cluster: detailed_tracking")).toBeInTheDocument();
  });
});
