import { FieldConfig } from "@clean-log/shared/types/field-config";
import { renderHook } from "@testing-library/react-native";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useEntryForm } from "../use-entry-form";

// Note: This test file requires @testing-library/react to be installed
// Run: pnpm add -D @testing-library/react
// For now, these are unit tests that can be run once the dependency is added

// Mock the useFieldConfigs hook
vi.mock("../use-field-configs", () => ({
  useFieldConfigs: vi.fn(),
  FieldErrors: {},
}));

// Mock the useFieldConfigs import
const mockUseFieldConfigs = vi.mocked(
  await import("../use-field-configs"),
).useFieldConfigs;

function createTestFieldConfig(overrides: Partial<FieldConfig>): FieldConfig {
  return {
    id: "test-id",
    organization_id: "org-id",
    name: "test_field",
    label: "Test Field",
    field_type: "text",
    description: null,
    required: false,
    order_position: 0,
    validation_rules: null,
    options: null,
    mutually_exclusive_group: null,
    group_cluster: null,
    section_id: null,
    conditional_logic: null,
    version: 1,
    active: true,
    archived_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockSchema(returnValue: any) {
  return {
    safeParse: vi.fn().mockReturnValue(returnValue),
  } as unknown as z.ZodObject<Record<string, z.ZodTypeAny>>;
}

describe("useEntryForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with empty errors", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        name: "name",
        label: "Name",
        field_type: "text",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "test-id": "" },
      sections: [],
      loading: false,
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    expect(result.current.errors).toEqual({});
  });

  it("should build submission data correctly for text field", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "name",
        label: "Name",
        field_type: "text",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": "John Doe" },
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      sections: [],
      loading: false,
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    const submissionData = result.current.buildSubmissionData();

    expect(submissionData).toEqual({
      name: "John Doe",
    });
  });

  it("should build submission data correctly for grouped_breakdown field", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "breakdown",
        label: "Breakdown",
        field_type: "grouped_breakdown",
      }),
    ];

    const breakdownValue = [
      { brand: "Brand A", quantity: 10 },
      { brand: "Brand B", quantity: 5 },
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": breakdownValue },
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      sections: [],
      loading: false,
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    const submissionData = result.current.buildSubmissionData();

    expect(submissionData).toEqual({
      breakdown: breakdownValue,
    });
  });

  it("should handle undefined grouped_breakdown as empty array", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "breakdown",
        label: "Breakdown",
        field_type: "grouped_breakdown",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: {},
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      sections: [],
      loading: false,
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    const submissionData = result.current.buildSubmissionData();

    expect(submissionData).toEqual({
      breakdown: [],
    });
  });

  it("should build submission data correctly for time field", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "time",
        label: "Time",
        field_type: "time",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": "14:30" },
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      sections: [],
      loading: false,
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    const submissionData = result.current.buildSubmissionData();

    expect(submissionData.time).toBe("14:30");
    expect(submissionData.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("should generate current time for empty time field", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "time",
        label: "Time",
        field_type: "time",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": "" },
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      sections: [],
      loading: false,
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    const submissionData = result.current.buildSubmissionData();

    expect(submissionData.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("should validate inputs and set errors on failure", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "name",
        label: "Name",
        field_type: "text",
        required: true,
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": "" },
      sections: [],
      loading: false,
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      FieldConfigSchema: createMockSchema({
        success: false,
        error: {
          issues: [
            {
              path: ["name"],
              message: "Name is required",
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    const submissionData = result.current.buildSubmissionData();
    const isValid = result.current.validateInputs(submissionData);

    expect(isValid).toBe(false);
    expect(result.current.errors).toEqual({
      name: "Name is required",
    });
  });

  it("should clear errors on successful validation", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "name",
        label: "Name",
        field_type: "text",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": "John Doe" },
      sections: [],
      loading: false,
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      FieldConfigSchema: createMockSchema({
        success: true,
        data: { name: "John Doe" },
      }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    // First set an error
    act(() => {
      result.current.clearFieldError("name");
    });

    const submissionData = result.current.buildSubmissionData();
    const isValid = result.current.validateInputs(submissionData);

    expect(isValid).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it("should reset form values", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "name",
        label: "Name",
        field_type: "text",
      }),
      createTestFieldConfig({
        id: "field-2",
        name: "age",
        label: "Age",
        field_type: "number",
      }),
      createTestFieldConfig({
        id: "field-3",
        name: "active",
        label: "Active",
        field_type: "boolean",
      }),
    ];

    const resetFieldValues = vi.fn();

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: {
        "field-1": "John Doe",
        "field-2": 25,
        "field-3": true,
      },
      resetFieldValues,
      updateFieldValue: vi.fn(),
      sections: [],
      loading: false,
      FieldConfigSchema: createMockSchema({ success: true, data: {} }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    act(() => {
      result.current.resetForm();
    });

    expect(resetFieldValues).toHaveBeenCalledWith({
      "field-1": "",
      "field-2": 0,
      "field-3": false,
    });
    expect(result.current.errors).toEqual({});
  });

  it("should clear field error", () => {
    const fieldConfigs = [
      createTestFieldConfig({
        id: "field-1",
        name: "name",
        label: "Name",
        field_type: "text",
      }),
    ];

    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs,
      fieldValues: { "field-1": "" },
      sections: [],
      loading: false,
      resetFieldValues: vi.fn(),
      updateFieldValue: vi.fn(),
      FieldConfigSchema: createMockSchema({
        success: false,
        error: {
          issues: [
            {
              path: ["name"],
              message: "Name is required",
            },
          ],
        },
      }),
    });

    const { result } = renderHook(() =>
      useEntryForm({ organizationId: "org-1" })
    );

    // Set an error first
    const submissionData = result.current.buildSubmissionData();
    result.current.validateInputs(submissionData);
    expect(result.current.errors.name).toBe("Name is required");

    // Clear the error
    act(() => {
      result.current.clearFieldError("name");
    });

    expect(result.current.errors.name).toBeUndefined();
  });
});
