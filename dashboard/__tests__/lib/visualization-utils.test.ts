import type { ChartConfig, Job } from "@/lib/types";
import {
  extractFieldValue,
  extractGroupedBreakdown,
  formatTimeGroup,
  getChartableFields,
  getGroupingFields,
  getGroupingKey,
  processJobDataForChart,
} from "@/lib/visualization-utils";
import type { FieldConfig } from "@clean-log/shared/types";
import { describe, expect, it } from "vitest";

// Test fixtures
const createFieldConfig = (overrides: Partial<FieldConfig>): FieldConfig => ({
  id: "test-id",
  organization_id: "test-org-id",
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
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createJob = (overrides: Partial<Job>): Job => ({
  id: "job-1",
  organization_id: "org-1",
  location_id: null,
  submission_data: {},
  completed_at: "2024-01-15T10:00:00Z",
  created_at: "2024-01-15T10:00:00Z",
  location: null,
  workers: [],
  ...overrides,
});

describe("extractFieldValue", () => {
  it("should return null for null submission_data", () => {
    const fieldConfig = createFieldConfig({ field_type: "number" });
    expect(extractFieldValue(null, fieldConfig)).toBeNull();
  });

  it("should return null when field is not in submission_data", () => {
    const submissionData = { other_field: 123 };
    const fieldConfig = createFieldConfig({
      name: "missing_field",
      field_type: "number",
    });
    expect(extractFieldValue(submissionData, fieldConfig)).toBeNull();
  });

  describe("number field", () => {
    it("should return valid number", () => {
      const submissionData = { count: 42 };
      const fieldConfig = createFieldConfig({
        name: "count",
        field_type: "number",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(42);
    });

    it("should return null for invalid type", () => {
      const submissionData = { count: "not a number" };
      const fieldConfig = createFieldConfig({
        name: "count",
        field_type: "number",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBeNull();
    });

    it("should return null for null value", () => {
      const submissionData = { count: null };
      const fieldConfig = createFieldConfig({
        name: "count",
        field_type: "number",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBeNull();
    });
  });

  describe("boolean field", () => {
    it("should return 1 for true", () => {
      const submissionData = { is_complete: true };
      const fieldConfig = createFieldConfig({
        name: "is_complete",
        field_type: "boolean",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(1);
    });

    it("should return 0 for false", () => {
      const submissionData = { is_complete: false };
      const fieldConfig = createFieldConfig({
        name: "is_complete",
        field_type: "boolean",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(0);
    });
  });

  describe("select field", () => {
    it("should return 1 when value exists", () => {
      const submissionData = { status: "active" };
      const fieldConfig = createFieldConfig({
        name: "status",
        field_type: "select",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(1);
    });

    it("should return 0 when value is empty", () => {
      const submissionData = { status: "" };
      const fieldConfig = createFieldConfig({
        name: "status",
        field_type: "select",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(0);
    });
  });

  describe("grouped_breakdown field", () => {
    it("should sum quantities from valid array", () => {
      const submissionData = {
        items: [
          { brand: "Brand A", quantity: 5 },
          { brand: "Brand B", quantity: 3 },
        ],
      };
      const fieldConfig = createFieldConfig({
        name: "items",
        field_type: "grouped_breakdown",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(8);
    });

    it("should return 0 for empty array", () => {
      const submissionData = { items: [] };
      const fieldConfig = createFieldConfig({
        name: "items",
        field_type: "grouped_breakdown",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(0);
    });

    it("should filter invalid items and sum valid ones", () => {
      const submissionData = {
        items: [
          { brand: "Brand A", quantity: 5 },
          { invalid: "item" },
          { brand: "Brand B", quantity: 3 },
        ],
      };
      const fieldConfig = createFieldConfig({
        name: "items",
        field_type: "grouped_breakdown",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBe(8);
    });

    it("should return null for non-array value", () => {
      const submissionData = { items: "not an array" };
      const fieldConfig = createFieldConfig({
        name: "items",
        field_type: "grouped_breakdown",
      });
      expect(extractFieldValue(submissionData, fieldConfig)).toBeNull();
    });
  });
});

describe("extractGroupedBreakdown", () => {
  it("should return null for null submission_data", () => {
    const fieldConfig = createFieldConfig({
      field_type: "grouped_breakdown",
    });
    expect(extractGroupedBreakdown(null, fieldConfig, "brand")).toBeNull();
  });

  it("should return null for non-grouped_breakdown field", () => {
    const submissionData = { items: [] };
    const fieldConfig = createFieldConfig({ field_type: "number" });
    expect(
      extractGroupedBreakdown(submissionData, fieldConfig, "brand"),
    ).toBeNull();
  });

  it("should extract valid breakdown array", () => {
    const submissionData = {
      items: [
        { brand: "Brand A", quantity: 5 },
        { brand: "Brand B", quantity: 3 },
      ],
    };
    const fieldConfig = createFieldConfig({
      name: "items",
      field_type: "grouped_breakdown",
    });
    const result = extractGroupedBreakdown(
      submissionData,
      fieldConfig,
      "brand",
    );
    expect(result).toEqual([
      { brand: "Brand A", quantity: 5 },
      { brand: "Brand B", quantity: 3 },
    ]);
  });

  it("should filter invalid items", () => {
    const submissionData = {
      items: [
        { brand: "Brand A", quantity: 5 },
        { invalid: "item" },
        { brand: "Brand B", quantity: 3 },
        { brand: 123, quantity: 2 }, // invalid brand type
      ],
    };
    const fieldConfig = createFieldConfig({
      name: "items",
      field_type: "grouped_breakdown",
    });
    const result = extractGroupedBreakdown(
      submissionData,
      fieldConfig,
      "brand",
    );
    expect(result).toEqual([
      { brand: "Brand A", quantity: 5 },
      { brand: "Brand B", quantity: 3 },
    ]);
  });

  it("should return null for non-array value", () => {
    const submissionData = { items: "not an array" };
    const fieldConfig = createFieldConfig({
      name: "items",
      field_type: "grouped_breakdown",
    });
    expect(
      extractGroupedBreakdown(submissionData, fieldConfig, "brand"),
    ).toBeNull();
  });

  it("should return empty array for empty array input", () => {
    const submissionData = { items: [] };
    const fieldConfig = createFieldConfig({
      name: "items",
      field_type: "grouped_breakdown",
    });
    const result = extractGroupedBreakdown(
      submissionData,
      fieldConfig,
      "brand",
    );
    expect(result).toEqual([]);
  });
});

describe("formatTimeGroup", () => {
  it("should format day period", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    expect(formatTimeGroup(date, "day")).toBe("2024-01-15");
  });

  it("should format week period", () => {
    const date = new Date("2024-01-15T10:30:00Z"); // Monday
    const result = formatTimeGroup(date, "week");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should format month period", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    expect(formatTimeGroup(date, "month")).toBe("2024-01");
  });

  it("should format year period", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    expect(formatTimeGroup(date, "year")).toBe("2024");
  });

  it("should handle string date input", () => {
    expect(formatTimeGroup("2024-01-15T10:30:00Z", "day")).toBe("2024-01-15");
  });

  it("should handle leap year", () => {
    const date = new Date("2024-02-29T10:30:00Z");
    expect(formatTimeGroup(date, "day")).toBe("2024-02-29");
  });

  it("should handle year boundary", () => {
    // Use a date earlier in the day to avoid timezone issues
    const date = new Date("2023-12-31T12:00:00Z");
    expect(formatTimeGroup(date, "day")).toBe("2023-12-31");
    expect(formatTimeGroup(date, "year")).toBe("2023");
  });
});

describe("getGroupingKey", () => {
  describe("time dimension", () => {
    it("should format with day period", () => {
      const job = createJob({
        completed_at: "2024-01-15T10:00:00Z",
      });
      const key = getGroupingKey(job, "time", undefined, "day");
      expect(key).toBe("2024-01-15");
    });

    it("should format with week period", () => {
      const job = createJob({
        completed_at: "2024-01-15T10:00:00Z",
      });
      const key = getGroupingKey(job, "time", undefined, "week");
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should default to day period", () => {
      const job = createJob({
        completed_at: "2024-01-15T10:00:00Z",
      });
      const key = getGroupingKey(job, "time");
      expect(key).toBe("2024-01-15");
    });
  });

  describe("worker dimension", () => {
    it("should return 'No Worker' for empty workers array", () => {
      const job = createJob({ workers: [] });
      expect(getGroupingKey(job, "worker")).toBe("No Worker");
    });

    it("should return worker name for single worker", () => {
      const job = createJob({
        workers: [
          {
            id: "w1",
            name: "John Doe",
            email: "john@example.com",
            phone: null,
          },
        ],
      });
      expect(getGroupingKey(job, "worker")).toBe("John Doe");
    });

    it("should join multiple worker names", () => {
      const job = createJob({
        workers: [
          { id: "w1", name: "John", email: "john@example.com", phone: null },
          { id: "w2", name: "Jane", email: "jane@example.com", phone: null },
        ],
      });
      expect(getGroupingKey(job, "worker")).toBe("John, Jane");
    });
  });

  describe("location dimension", () => {
    it("should return location name when present", () => {
      const job = createJob({
        location: {
          id: "loc1",
          name: "Main Office",
          email: "office@example.com",
          address: null,
          contact_person: null,
          phone: null,
        },
      });
      expect(getGroupingKey(job, "location")).toBe("Main Office");
    });

    it("should return 'No Location' when location is null", () => {
      const job = createJob({ location: null });
      expect(getGroupingKey(job, "location")).toBe("No Location");
    });
  });

  describe("field dimension", () => {
    it("should return string value", () => {
      const job = createJob({
        submission_data: { status: "active" },
      });
      const groupingFieldConfig = createFieldConfig({
        name: "status",
        field_type: "select",
      });
      expect(getGroupingKey(job, "field", groupingFieldConfig)).toBe("active");
    });

    it("should return number as string", () => {
      const job = createJob({
        submission_data: { priority: 5 },
      });
      const groupingFieldConfig = createFieldConfig({
        name: "priority",
        field_type: "number",
      });
      expect(getGroupingKey(job, "field", groupingFieldConfig)).toBe("5");
    });

    it("should return 'Yes' for boolean true", () => {
      const job = createJob({
        submission_data: { is_complete: true },
      });
      const groupingFieldConfig = createFieldConfig({
        name: "is_complete",
        field_type: "boolean",
      });
      expect(getGroupingKey(job, "field", groupingFieldConfig)).toBe("Yes");
    });

    it("should return 'No' for boolean false", () => {
      const job = createJob({
        submission_data: { is_complete: false },
      });
      const groupingFieldConfig = createFieldConfig({
        name: "is_complete",
        field_type: "boolean",
      });
      expect(getGroupingKey(job, "field", groupingFieldConfig)).toBe("No");
    });

    it("should return 'N/A' for null value", () => {
      const job = createJob({
        submission_data: { status: null },
      });
      const groupingFieldConfig = createFieldConfig({
        name: "status",
        field_type: "select",
      });
      expect(getGroupingKey(job, "field", groupingFieldConfig)).toBe("N/A");
    });

    it("should return 'Unknown' when groupingFieldConfig is missing", () => {
      const job = createJob({});
      expect(getGroupingKey(job, "field")).toBe("Unknown");
    });
  });
});

describe("processJobDataForChart", () => {
  const numericFieldConfig = createFieldConfig({
    id: "field-1",
    name: "count",
    field_type: "number",
  });

  it("should return null when fieldConfig not found", () => {
    const jobs = [createJob({})];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "non-existent",
      groupingDimension: "time",
    };
    expect(
      processJobDataForChart(jobs, chartConfig, [numericFieldConfig]),
    ).toBeNull();
  });

  it("should return null for field dimension without groupingFieldConfigId", () => {
    const jobs = [createJob({})];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "field",
    };
    expect(
      processJobDataForChart(jobs, chartConfig, [numericFieldConfig]),
    ).toBeNull();
  });

  it("should process numeric field with time grouping", () => {
    const jobs = [
      createJob({
        completed_at: "2024-01-15T10:00:00Z",
        submission_data: { count: 10 },
      }),
      createJob({
        completed_at: "2024-01-15T11:00:00Z",
        submission_data: { count: 20 },
      }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "time",
      timePeriod: "day",
      aggregationType: "sum",
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data).toHaveLength(1);
    expect(result?.data[0].value).toBe(30);
  });

  it("should process numeric field with worker grouping", () => {
    const jobs = [
      createJob({
        submission_data: { count: 10 },
        workers: [
          { id: "w1", name: "John", email: "john@example.com", phone: null },
        ],
      }),
      createJob({
        submission_data: { count: 20 },
        workers: [
          { id: "w1", name: "John", email: "john@example.com", phone: null },
        ],
      }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "worker",
      aggregationType: "sum",
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data[0].name).toBe("John");
    expect(result?.data[0].value).toBe(30);
  });

  it("should filter by date range", () => {
    const jobs = [
      createJob({
        completed_at: "2024-01-15T10:00:00Z",
        submission_data: { count: 10 },
      }),
      createJob({
        completed_at: "2024-02-15T10:00:00Z",
        submission_data: { count: 20 },
      }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "time",
      timePeriod: "day",
      aggregationType: "sum",
      dateRange: {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      },
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data).toHaveLength(1);
    expect(result?.data[0].value).toBe(10);
  });

  it("should aggregate with average", () => {
    const jobs = [
      createJob({
        completed_at: "2024-01-15T10:00:00Z",
        submission_data: { count: 10 },
      }),
      createJob({
        completed_at: "2024-01-15T11:00:00Z",
        submission_data: { count: 20 },
      }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "time",
      timePeriod: "day",
      aggregationType: "average",
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data[0].value).toBe(15);
  });

  it("should aggregate with count", () => {
    const jobs = [
      createJob({
        completed_at: "2024-01-15T10:00:00Z",
        submission_data: { count: 10 },
      }),
      createJob({
        completed_at: "2024-01-15T11:00:00Z",
        submission_data: { count: 20 },
      }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "time",
      timePeriod: "day",
      aggregationType: "count",
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data[0].value).toBe(2);
  });

  it("should handle grouped_breakdown field with brand mode", () => {
    const breakdownFieldConfig = createFieldConfig({
      id: "field-2",
      name: "items",
      field_type: "grouped_breakdown",
      options: ["Brand A", "Brand B"],
    });
    const jobs = [
      createJob({
        submission_data: {
          items: [
            { brand: "Brand A", quantity: 5 },
            { brand: "Brand B", quantity: 3 },
          ],
        },
      }),
      createJob({
        submission_data: {
          items: [{ brand: "Brand A", quantity: 2 }],
        },
      }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "pie",
      fieldConfigId: "field-2",
      groupingDimension: "time",
      groupedBreakdownMode: "brand",
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      breakdownFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data.length).toBeGreaterThan(0);
    const brandA = result?.data.find((d) => d.name === "Brand A");
    expect(brandA?.value).toBe(7);
  });

  it("should handle empty jobs array", () => {
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "time",
      aggregationType: "sum",
    };
    const result = processJobDataForChart([], chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    expect(result?.data).toHaveLength(0);
  });

  it("should handle jobs with null submission_data", () => {
    const jobs = [
      createJob({ submission_data: null }),
      createJob({ submission_data: { count: 10 } }),
    ];
    const chartConfig: ChartConfig = {
      chartType: "bar",
      fieldConfigId: "field-1",
      groupingDimension: "time",
      aggregationType: "sum",
    };
    const result = processJobDataForChart(jobs, chartConfig, [
      numericFieldConfig,
    ]);
    expect(result).not.toBeNull();
    // Should only process the job with valid data
    expect(result?.data[0].value).toBe(10);
  });
});

describe("getChartableFields", () => {
  it("should filter chartable field types", () => {
    const fieldConfigs = [
      createFieldConfig({ field_type: "number" }),
      createFieldConfig({ field_type: "grouped_breakdown" }),
      createFieldConfig({ field_type: "select" }),
      createFieldConfig({ field_type: "boolean" }),
      createFieldConfig({ field_type: "text" }),
      createFieldConfig({ field_type: "textarea" }),
    ];
    const result = getChartableFields(fieldConfigs);
    expect(result).toHaveLength(4);
    expect(result.map((f) => f.field_type)).toEqual([
      "number",
      "grouped_breakdown",
      "select",
      "boolean",
    ]);
  });

  it("should exclude non-chartable types", () => {
    const fieldConfigs = [
      createFieldConfig({ field_type: "text" }),
      createFieldConfig({ field_type: "textarea" }),
      createFieldConfig({ field_type: "date" }),
      createFieldConfig({ field_type: "time" }),
      createFieldConfig({ field_type: "email" }),
      createFieldConfig({ field_type: "phone" }),
    ];
    const result = getChartableFields(fieldConfigs);
    expect(result).toHaveLength(0);
  });
});

describe("getGroupingFields", () => {
  it("should filter grouping field types", () => {
    const fieldConfigs = [
      createFieldConfig({ field_type: "select" }),
      createFieldConfig({ field_type: "text" }),
      createFieldConfig({ field_type: "boolean" }),
      createFieldConfig({ field_type: "number" }),
      createFieldConfig({ field_type: "grouped_breakdown" }),
    ];
    const result = getGroupingFields(fieldConfigs);
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.field_type)).toEqual([
      "select",
      "text",
      "boolean",
    ]);
  });

  it("should exclude non-grouping types", () => {
    const fieldConfigs = [
      createFieldConfig({ field_type: "number" }),
      createFieldConfig({ field_type: "date" }),
      createFieldConfig({ field_type: "time" }),
    ];
    const result = getGroupingFields(fieldConfigs);
    expect(result).toHaveLength(0);
  });
});
