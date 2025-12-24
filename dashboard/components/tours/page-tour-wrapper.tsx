"use client";

import { ReactNode } from "react";
import { PageTourProvider } from "./page-tour-context";
import { PageTourPrompt } from "./page-tour-prompt";
import { PageTourTooltip, TourStep } from "./page-tour-tooltip";

interface PageTourWrapperProps {
  children: ReactNode;
  pageId: string;
  steps: TourStep[];
}

export function PageTourWrapper({
  children,
  pageId,
  steps,
}: PageTourWrapperProps) {
  return (
    <PageTourProvider pageId={pageId} totalSteps={steps.length}>
      {children}
      <PageTourPrompt />
      <PageTourTooltip steps={steps} />
    </PageTourProvider>
  );
}
