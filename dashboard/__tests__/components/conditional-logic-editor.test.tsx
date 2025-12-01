import { createMockFieldConfig } from "@/__tests__/lib/fixtures";
import { ConditionalLogicEditor } from "@/components/form-builder/conditional-logic-editor";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("ConditionalLogicEditor", () => {
  it("shows warning when conditions reference multiple mutually exclusive groups", () => {
    const targetField = createMockFieldConfig({
      id: "field-target",
      label: "Target Field",
      conditional_logic: {
        match_type: "all",
        conditions: [
          { field_id: "field-a", operator: "is_not_empty" },
          { field_id: "field-b", operator: "is_not_empty" },
        ],
      },
    });

    const fieldA = createMockFieldConfig({
      id: "field-a",
      label: "Field A",
      mutually_exclusive_group: "group_a",
    });

    const fieldB = createMockFieldConfig({
      id: "field-b",
      label: "Field B",
      mutually_exclusive_group: "group_b",
    });

    render(
      <ConditionalLogicEditor
        field={targetField}
        allFields={[targetField, fieldA, fieldB]}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        /Conditions reference multiple mutually exclusive groups/i
      )
    ).toBeInTheDocument();
  });
});
