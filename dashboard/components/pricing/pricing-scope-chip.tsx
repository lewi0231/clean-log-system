"use client";

import { Badge } from "@/components/ui/badge";
import type { ScopeChipVariant } from "@/lib/pricing-scope-display";
import { cn } from "@/lib/utils";

const CHIP_LABELS: Record<ScopeChipVariant, string> = {
  "all-yards-default": "All yards default",
  "yard-override": "Yard override",
  inherited: "Inherited",
  mixed: "Mixed scope",
};

interface PricingScopeChipProps {
  variant: ScopeChipVariant;
  inheritedLabel?: string | null;
  className?: string;
}

export function PricingScopeChip({ variant, inheritedLabel, className }: PricingScopeChipProps) {
  return (
    <div className={cn("flex flex-col gap-0.5 min-w-0", className)}>
      <Badge
        variant={variant === "yard-override" ? "default" : "secondary"}
        className="text-xs font-normal w-fit"
      >
        {CHIP_LABELS[variant]}
      </Badge>
      {inheritedLabel && (
        <span className="text-xs text-muted-foreground truncate" title={inheritedLabel}>
          {inheritedLabel}
        </span>
      )}
    </div>
  );
}
