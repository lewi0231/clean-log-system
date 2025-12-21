"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChartConfig } from "@/lib/types";
import {
  getChartableFields,
  getGroupingFields,
} from "@/lib/visualization-utils";
import type { FieldConfig } from "@clean-log/shared/types";

interface ChartConfigProps {
  fieldConfigs: FieldConfig[];
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
}

export default function ChartConfigComponent({
  fieldConfigs,
  config,
  onConfigChange,
}: ChartConfigProps) {
  const chartableFields = getChartableFields(fieldConfigs);
  const groupingFields = getGroupingFields(fieldConfigs);
  const selectedField = chartableFields.find(
    (fc) => fc.id === config.fieldConfigId
  );
  const isGroupedBreakdown = selectedField?.field_type === "grouped_breakdown";
  const isNumericField = selectedField?.field_type === "number";

  const updateConfig = (updates: Partial<ChartConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chart Configuration</CardTitle>
        <CardDescription>Customize your visualization settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart Type */}
        <div className="space-y-2">
          <Label htmlFor="chart-type">Chart Type</Label>
          <Select
            value={config.chartType}
            onValueChange={(value: ChartConfig["chartType"]) =>
              updateConfig({ chartType: value })
            }
          >
            <SelectTrigger id="chart-type">
              <SelectValue placeholder="Select chart type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area">Area Chart</SelectItem>
              <SelectItem value="line">Line Chart</SelectItem>
              <SelectItem value="bar">Bar Chart</SelectItem>
              <SelectItem value="pie">Pie Chart</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Field Selection */}
        <div className="space-y-2">
          <Label htmlFor="field">Field to Visualize</Label>
          <Select
            value={config.fieldConfigId || ""}
            onValueChange={(value) =>
              updateConfig({ fieldConfigId: value || null })
            }
          >
            <SelectTrigger id="field">
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              {chartableFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label} ({field.field_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grouped Breakdown Mode */}
        {isGroupedBreakdown && (
          <div className="space-y-2">
            <Label htmlFor="breakdown-mode">Breakdown Mode</Label>
            <Select
              value={config.groupedBreakdownMode || "quantity"}
              onValueChange={(value: "brand" | "quantity") =>
                updateConfig({ groupedBreakdownMode: value })
              }
            >
              <SelectTrigger id="breakdown-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand">By Option (Distribution)</SelectItem>
                <SelectItem value="quantity">Quantity Over Time</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.groupedBreakdownMode === "brand"
                ? "Shows distribution of quantities by option"
                : "Shows total quantities grouped by selected dimension"}
            </p>
          </div>
        )}

        {/* Aggregation Type for Numeric Fields */}
        {isNumericField && (
          <div className="space-y-2">
            <Label htmlFor="aggregation">Aggregation</Label>
            <Select
              value={config.aggregationType || "sum"}
              onValueChange={(value: "sum" | "average" | "count") =>
                updateConfig({ aggregationType: value })
              }
            >
              <SelectTrigger id="aggregation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="average">Average</SelectItem>
                <SelectItem value="count">Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Grouping Dimension */}
        <div className="space-y-2">
          <Label htmlFor="grouping">Group By</Label>
          <Select
            value={config.groupingDimension}
            onValueChange={(value: ChartConfig["groupingDimension"]) =>
              updateConfig({ groupingDimension: value })
            }
          >
            <SelectTrigger id="grouping">
              <SelectValue placeholder="Select grouping" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="location">Location</SelectItem>
              <SelectItem value="field">Custom Field</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Period (when grouping by time) */}
        {config.groupingDimension === "time" && (
          <div className="space-y-2">
            <Label htmlFor="time-period">Time Period</Label>
            <Select
              value={config.timePeriod || "day"}
              onValueChange={(value) =>
                updateConfig({ timePeriod: value as ChartConfig["timePeriod"] })
              }
            >
              <SelectTrigger id="time-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Grouping Field (when grouping by field) */}
        {config.groupingDimension === "field" && (
          <div className="space-y-2">
            <Label htmlFor="grouping-field">Grouping Field</Label>
            <Select
              value={config.groupingFieldConfigId || ""}
              onValueChange={(value) =>
                updateConfig({ groupingFieldConfigId: value || null })
              }
            >
              <SelectTrigger id="grouping-field">
                <SelectValue placeholder="Select a field to group by" />
              </SelectTrigger>
              <SelectContent>
                {groupingFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label} ({field.field_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date Range (Optional)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="start-date" className="text-xs">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={
                  config.dateRange?.start
                    ? config.dateRange.start.toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const start = e.target.value
                    ? new Date(e.target.value)
                    : undefined;
                  updateConfig({
                    dateRange: start
                      ? {
                          start,
                          end: config.dateRange?.end || new Date(),
                        }
                      : undefined,
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-date" className="text-xs">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={
                  config.dateRange?.end
                    ? config.dateRange.end.toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  const end = e.target.value
                    ? new Date(e.target.value)
                    : undefined;
                  updateConfig({
                    dateRange: end
                      ? {
                          start: config.dateRange?.start || new Date(0),
                          end,
                        }
                      : undefined,
                  });
                }}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateConfig({ dateRange: undefined })}
            className="w-full"
          >
            Clear Date Range
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
