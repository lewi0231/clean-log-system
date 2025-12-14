"use client";

import { cn } from "@/lib/utils";

export interface ProgressProps {
  value: number; // 0-100
  className?: string;
}

function Progress({ value, className }: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "w-full h-2 bg-gray-200 rounded-full overflow-hidden",
        className
      )}
    >
      <div
        className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}

Progress.displayName = "Progress";

export { Progress };
