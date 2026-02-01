"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorState } from "@/components/ui/error-state";
import {
  ChartSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton-loaders";
import AreaChartComponent from "@/components/visualizations/area-chart";
import BarChartComponent from "@/components/visualizations/bar-chart";
import ChartConfigComponent from "@/components/visualizations/chart-config";
import LineChartComponent from "@/components/visualizations/line-chart";
import PieChartComponent from "@/components/visualizations/pie-chart";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useJobs } from "@/hooks/use-jobs";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import type { ChartConfig } from "@/lib/types";
import {
  processJobDataForChart,
  type ProcessedChartData,
} from "@/lib/visualization-utils";
import { useMemo, useState } from "react";

export default function VisualizationPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { jobs, loading: jobsLoading, error: jobsError } = useJobs();
  const {
    fieldConfigs,
    loading: fieldConfigsLoading,
    error: fieldConfigsError,
  } = useFieldConfigs();

  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: "area",
    fieldConfigId: null,
    groupingDimension: "time",
    timePeriod: "day",
    aggregationType: "sum",
  });

  const loading = jobsLoading || fieldConfigsLoading;
  const error = jobsError || fieldConfigsError;

  const processed = useMemo((): {
    data: ProcessedChartData | null;
    error: string | null;
  } => {
    if (!chartConfig.fieldConfigId || jobs.length === 0) {
      return { data: null, error: null };
    }

    try {
      return {
        data: processJobDataForChart(jobs, chartConfig, fieldConfigs),
        error: null,
      };
    } catch (err) {
      log.error("VisualizationPage: Failed to process chart data", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return {
        data: null,
        error:
          err instanceof Error
            ? err.message
            : "Failed to process data for the selected configuration",
      };
    }
  }, [jobs, chartConfig, fieldConfigs]);

  // Get chart title
  const chartTitle = useMemo(() => {
    if (!chartConfig.fieldConfigId) return "";
    const fieldConfig = fieldConfigs.find(
      (fc) => fc.id === chartConfig.fieldConfigId
    );
    if (!fieldConfig) return "";

    const groupingLabel =
      chartConfig.groupingDimension === "time"
        ? `by ${chartConfig.timePeriod}`
        : chartConfig.groupingDimension === "worker"
        ? "by Worker"
        : chartConfig.groupingDimension === "location"
        ? "by Location"
        : "by Field";

    return `${fieldConfig.label} ${groupingLabel}`;
  }, [chartConfig, fieldConfigs]);

  if (orgLoading || loading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
            </div>
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="pt-6">
                <ChartSkeleton />
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  if (error) {
    return <ErrorState message={error} fullScreen />;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Visualizations</h1>
        <p className="text-muted-foreground mt-2">
          Create interactive charts based on your field configurations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <ChartConfigComponent
            fieldConfigs={fieldConfigs}
            config={chartConfig}
            onConfigChange={setChartConfig}
          />
        </div>

        {/* Chart Display */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              {!chartConfig.fieldConfigId ? (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Select a field to visualize
                </div>
              ) : processed.error ? (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTitle>Unable to build chart</AlertTitle>
                    <AlertDescription>{processed.error}</AlertDescription>
                  </Alert>
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                    Try changing the field, grouping, or time period.
                  </div>
                </div>
              ) : !processed.data || processed.data.data.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  No data available for the selected configuration
                </div>
              ) : (
                <>
                  {chartConfig.chartType === "area" && (
                    <AreaChartComponent data={processed.data} title={chartTitle} />
                  )}
                  {chartConfig.chartType === "line" && (
                    <LineChartComponent data={processed.data} title={chartTitle} />
                  )}
                  {chartConfig.chartType === "bar" && (
                    <BarChartComponent data={processed.data} title={chartTitle} />
                  )}
                  {chartConfig.chartType === "pie" && (
                    <PieChartComponent data={processed.data} title={chartTitle} />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
