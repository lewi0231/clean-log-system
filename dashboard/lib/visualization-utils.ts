import type { FieldConfig } from "@/shared/types/field-config";
import {
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { ChartConfig, GroupingDimension, Job, TimePeriod } from "./types";

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface ProcessedChartData {
  data: ChartDataPoint[];
  dataKey: string;
  nameKey: string;
}

/**
 * Extract and normalize field value from submission_data
 */
export function extractFieldValue(
  submissionData: Record<string, unknown> | null,
  fieldConfig: FieldConfig
): number | null {
  if (!submissionData) return null;

  const fieldName = fieldConfig.name;
  const value = submissionData[fieldName];

  if (value === null || value === undefined) return null;

  switch (fieldConfig.field_type) {
    case "number":
      return typeof value === "number" ? value : null;

    case "grouped_breakdown":
      if (Array.isArray(value)) {
        // Sum all quantities
        return value.reduce((sum: number, item: unknown) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "quantity" in item &&
            typeof (item as { quantity: unknown }).quantity === "number"
          ) {
            return sum + (item as { quantity: number }).quantity;
          }
          return sum;
        }, 0);
      }
      return null;

    case "boolean":
      return value === true ? 1 : 0;

    case "select":
      // Count as 1 if value exists
      return value ? 1 : 0;

    default:
      return null;
  }
}

/**
 * Extract grouped breakdown data (brands and quantities)
 */
export function extractGroupedBreakdown(
  submissionData: Record<string, unknown> | null,
  fieldConfig: FieldConfig,
  mode: "brand" | "quantity"
): Array<{ brand: string; quantity: number }> | null {
  if (!submissionData || fieldConfig.field_type !== "grouped_breakdown") {
    return null;
  }

  const fieldName = fieldConfig.name;
  const value = submissionData[fieldName];

  if (!Array.isArray(value)) return null;

  return value.filter(
    (item): item is { brand: string; quantity: number } =>
      typeof item === "object" &&
      item !== null &&
      "brand" in item &&
      "quantity" in item &&
      typeof item.brand === "string" &&
      typeof item.quantity === "number"
  );
}

/**
 * Format time-based grouping
 */
export function formatTimeGroup(
  date: Date | string,
  period: TimePeriod
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;

  switch (period) {
    case "day":
      return format(startOfDay(dateObj), "yyyy-MM-dd");
    case "week":
      return format(startOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "month":
      return format(startOfMonth(dateObj), "yyyy-MM");
    case "year":
      return format(startOfYear(dateObj), "yyyy");
    default:
      return format(dateObj, "yyyy-MM-dd");
  }
}

/**
 * Get grouping key based on dimension
 */
export function getGroupingKey(
  job: Job,
  dimension: GroupingDimension,
  groupingFieldConfig?: FieldConfig | null,
  timePeriod?: TimePeriod
): string {
  switch (dimension) {
    case "time":
      return formatTimeGroup(job.completed_at, timePeriod || "day");

    case "worker":
      if (job.workers.length === 0) return "No Worker";
      if (job.workers.length === 1) return job.workers[0].name;
      return job.workers.map((w) => w.name).join(", ");

    case "location":
      return job.location?.name || "No Location";

    case "field":
      if (!groupingFieldConfig) return "Unknown";
      const fieldValue = job.submission_data?.[groupingFieldConfig.name];
      if (fieldValue === null || fieldValue === undefined) return "N/A";
      if (typeof fieldValue === "string" || typeof fieldValue === "number") {
        return String(fieldValue);
      }
      if (typeof fieldValue === "boolean") {
        return fieldValue ? "Yes" : "No";
      }
      return String(fieldValue);

    default:
      return "Unknown";
  }
}

/**
 * Process jobs into chart-ready data
 */
export function processJobDataForChart(
  jobs: Job[],
  chartConfig: ChartConfig,
  fieldConfigs: FieldConfig[]
): ProcessedChartData | null {
  const fieldConfig = fieldConfigs.find(
    (fc) => fc.id === chartConfig.fieldConfigId
  );

  if (!fieldConfig) return null;

  // Validate grouping field config if grouping by field
  if (
    chartConfig.groupingDimension === "field" &&
    !chartConfig.groupingFieldConfigId
  ) {
    return null;
  }

  // Filter jobs by date range if specified
  let filteredJobs = jobs;
  if (chartConfig.dateRange) {
    filteredJobs = jobs.filter((job) => {
      const jobDate = parseISO(job.completed_at);
      return (
        jobDate >= chartConfig.dateRange!.start &&
        jobDate <= chartConfig.dateRange!.end
      );
    });
  }

  // Handle grouped_breakdown fields specially
  if (fieldConfig.field_type === "grouped_breakdown") {
    return processGroupedBreakdownData(
      filteredJobs,
      fieldConfig,
      chartConfig,
      fieldConfigs
    );
  }

  // Handle regular fields
  const groupingFieldConfig =
    chartConfig.groupingDimension === "field" &&
    chartConfig.groupingFieldConfigId
      ? fieldConfigs.find((fc) => fc.id === chartConfig.groupingFieldConfigId)
      : null;

  const groupedData = new Map<string, number[]>();

  filteredJobs.forEach((job) => {
    const groupingKey = getGroupingKey(
      job,
      chartConfig.groupingDimension,
      groupingFieldConfig,
      chartConfig.timePeriod
    );

    const value = extractFieldValue(job.submission_data, fieldConfig);
    if (value !== null) {
      if (!groupedData.has(groupingKey)) {
        groupedData.set(groupingKey, []);
      }
      groupedData.get(groupingKey)!.push(value);
    }
  });

  // Aggregate values
  const data: ChartDataPoint[] = Array.from(groupedData.entries()).map(
    ([name, values]) => {
      let aggregatedValue: number;
      switch (chartConfig.aggregationType) {
        case "average":
          aggregatedValue =
            values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case "count":
          aggregatedValue = values.length;
          break;
        case "sum":
        default:
          aggregatedValue = values.reduce((sum, val) => sum + val, 0);
          break;
      }

      return {
        name,
        value: aggregatedValue,
      };
    }
  );

  // Sort by name for consistent display (time-based should be chronological)
  if (chartConfig.groupingDimension === "time") {
    // Keep chronological order for time-based charts
    data.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Sort by name alphabetically for other dimensions
    data.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    data,
    dataKey: "value",
    nameKey: "name",
  };
}

/**
 * Process grouped_breakdown data
 */
function processGroupedBreakdownData(
  jobs: Job[],
  fieldConfig: FieldConfig,
  chartConfig: ChartConfig,
  fieldConfigs: FieldConfig[]
): ProcessedChartData {
  const mode = chartConfig.groupedBreakdownMode || "quantity";

  if (mode === "brand") {
    // Aggregate by brand across all jobs
    const brandData = new Map<string, number>();

    jobs.forEach((job) => {
      const breakdown = extractGroupedBreakdown(
        job.submission_data,
        fieldConfig,
        "brand"
      );
      if (breakdown) {
        breakdown.forEach((item) => {
          const current = brandData.get(item.brand) || 0;
          brandData.set(item.brand, current + item.quantity);
        });
      }
    });

    const data: ChartDataPoint[] = Array.from(brandData.entries()).map(
      ([brand, quantity]) => ({
        name: brand,
        value: quantity,
      })
    );

    data.sort((a, b) => b.value - a.value); // Sort by quantity descending

    return {
      data,
      dataKey: "value",
      nameKey: "name",
    };
  } else {
    // Quantity over time/worker/location
    const groupingFieldConfig =
      chartConfig.groupingDimension === "field" &&
      chartConfig.groupingFieldConfigId
        ? fieldConfigs.find((fc) => fc.id === chartConfig.groupingFieldConfigId)
        : null;

    const groupedData = new Map<string, number>();

    jobs.forEach((job) => {
      const groupingKey = getGroupingKey(
        job,
        chartConfig.groupingDimension,
        groupingFieldConfig,
        chartConfig.timePeriod
      );

      const breakdown = extractGroupedBreakdown(
        job.submission_data,
        fieldConfig,
        "quantity"
      );
      if (breakdown) {
        const totalQuantity = breakdown.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        const current = groupedData.get(groupingKey) || 0;
        groupedData.set(groupingKey, current + totalQuantity);
      }
    });

    const data: ChartDataPoint[] = Array.from(groupedData.entries()).map(
      ([name, value]) => ({
        name,
        value,
      })
    );

    // Sort by name for time-based, by value for others
    if (chartConfig.groupingDimension === "time") {
      data.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      data.sort((a, b) => b.value - a.value);
    }

    return {
      data,
      dataKey: "value",
      nameKey: "name",
    };
  }
}

/**
 * Get chartable fields (numeric, grouped_breakdown, select, boolean)
 */
export function getChartableFields(fieldConfigs: FieldConfig[]): FieldConfig[] {
  return fieldConfigs.filter(
    (fc) =>
      fc.field_type === "number" ||
      fc.field_type === "grouped_breakdown" ||
      fc.field_type === "select" ||
      fc.field_type === "boolean"
  );
}

/**
 * Get fields suitable for grouping
 */
export function getGroupingFields(fieldConfigs: FieldConfig[]): FieldConfig[] {
  return fieldConfigs.filter(
    (fc) =>
      fc.field_type === "select" ||
      fc.field_type === "text" ||
      fc.field_type === "boolean"
  );
}
