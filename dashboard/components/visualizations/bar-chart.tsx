"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ProcessedChartData } from "@/lib/visualization-utils";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface BarChartComponentProps {
  data: ProcessedChartData;
  title?: string;
}

export default function BarChartComponent({
  data,
  title,
}: BarChartComponentProps) {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available for this chart
      </div>
    );
  }

  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="space-y-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
        <BarChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={data.nameKey}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey={data.dataKey}
            fill="hsl(var(--chart-1))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
