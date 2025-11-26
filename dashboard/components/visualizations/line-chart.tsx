"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ProcessedChartData } from "@/lib/visualization-utils";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

interface LineChartComponentProps {
  data: ProcessedChartData;
  title?: string;
}

export default function LineChartComponent({
  data,
  title,
}: LineChartComponentProps) {
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
        <LineChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={data.nameKey}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey={data.dataKey}
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
