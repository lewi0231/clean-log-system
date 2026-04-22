"use client";

import { ErrorState } from "@/components/ui/error-state";
import { log } from "@/lib/logger";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    log.error("Dashboard error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message={error.message || "An unexpected error occurred"}
      onRetry={reset}
      fullScreen
    />
  );
}
