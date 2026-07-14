"use client";

import { Badge } from "@/components/ui/badge";
import type { ScopeChipVariant } from "@/lib/pricing-scope-display";
import { cn } from "@/lib/utils";

const CHIP_LABELS: Record<ScopeChipVariant, string> = {
  "all-yards-default": "Default",
  "yard-override": "Override",
  inherited: "Inherited",
  mixed: "Override", // Treat mixed as override - user feedback: mixed badge is redundant
};

interface PricingScopeChipProps {
  variant: ScopeChipVariant;
  inheritedLabel?: string | null;
  className?: string;
}

export function PricingScopeChip({ variant, inheritedLabel, className }: PricingScopeChipProps) {
  // Don't render for "mixed" - use only the override badge
  const effectiveVariant = variant === "mixed" ? "yard-override" : variant;

  return (
    <div className={cn("flex flex-col gap-0.5 min-w-0", className)}>
      <Badge
        variant={effectiveVariant === "yard-override" ? "default" : "secondary"}
        className="text-xs font-normal w-fit"
      >
        {CHIP_LABELS[effectiveVariant]}
      </Badge>
      {inheritedLabel && (
        <span className="text-xs text-muted-foreground truncate" title={inheritedLabel}>
          {inheritedLabel}
        </span>
      )}
    </div>
  );
}
