"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { X } from "lucide-react";
import { usePageTour } from "./page-tour-context";

export function PageTourPrompt() {
  const { showTourPrompt, startTour, dismissTourPrompt } = usePageTour();

  if (!showTourPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in-0">
      <Card className="w-80 shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">Take a quick tour?</CardTitle>
              <CardDescription className="mt-1">
                We&apos;ll show you around this page in just a few steps
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={dismissTourPrompt}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardFooter className="flex gap-2 pt-0">
          <Button
            variant="outline"
            onClick={dismissTourPrompt}
            className="flex-1"
          >
            Maybe later
          </Button>
          <Button onClick={startTour} className="flex-1">
            Start tour
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
