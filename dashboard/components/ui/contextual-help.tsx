"use client";

/**
 * Progressive disclosure for supplementary copy (onboarding hints, “how this works”).
 *
 * UX rationale (common patterns):
 * - **Progressive disclosure** (NN/g, Material): keep primary UI dense; offer detail on demand so
 *   experienced users are not repeatedly interrupted by static helper text.
 * - **Icon + popover** works for mouse and touch (unlike hover-only tooltips for long content).
 * - Do not put **required** task steps only inside this component — use it for optional context.
 *
 * @see https://www.nngroup.com/articles/progressive-disclosure/
 */

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

export interface ContextualHelpProps {
  /** Short label for the trigger (screen readers + visible title inside popover). */
  label: string;
  /** Body content (links, short paragraphs). */
  children: ReactNode;
  /** Optional class on the icon trigger. */
  className?: string;
  /** Popover content width (default matches design system popover). */
  contentClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export function ContextualHelp({
  label,
  children,
  className,
  contentClassName,
  align = "start",
  side = "bottom",
}: ContextualHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
          aria-label={label}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn("max-w-sm text-sm leading-relaxed", contentClassName)}
      >
        <p className="font-medium text-foreground mb-2">{label}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
