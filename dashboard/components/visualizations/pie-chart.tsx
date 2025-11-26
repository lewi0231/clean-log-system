"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ProcessedChartData } from "@/lib/visualization-utils";
import { Cell, Legend, Pie, PieChart } from "recharts";

interface PieChartComponentProps {
  data: ProcessedChartData;
  title?: string;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function PieChartComponent({
  data,
  title,
}: PieChartComponentProps) {
  if (!data.data || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available for this chart
      </div>
    );
  }

  const chartConfig = data.data.reduce((acc, item, index) => {
    acc[item.name] = {
      label: String(item.name),
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="space-y-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={data.data}
            dataKey={data.dataKey}
            nameKey={data.nameKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {data.data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Legend
            content={<ChartLegend />}
            wrapperStyle={{ paddingTop: "1rem" }}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
