"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const M7_TOOLTIP =
  "This amount was split equally among workers on the job. No time-based allocation was used for this share.";

export function EqualSplitBadge({ className }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={className} aria-label={`Equal split. ${M7_TOOLTIP}`}>
            Equal split
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="top">
          {M7_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
