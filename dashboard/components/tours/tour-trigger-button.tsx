"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Play } from "lucide-react";
import { usePageTour } from "./page-tour-context";

export function TourTriggerButton() {
  const { startTour, hasSeenTour, hasSkippedTour, isTourActive } =
    usePageTour();

  // Don't show if tour is already active
  if (isTourActive) {
    return null;
  }

  // Show if tour hasn't been seen or was skipped
  if (!hasSeenTour || hasSkippedTour) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={startTour}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Take tour
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Take a guided tour of this page</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
