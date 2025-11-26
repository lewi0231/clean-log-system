"use client";

import CompletedJobsList from "@/components/completed-jobs/completed-jobs-list";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useJobs } from "@/hooks/use-jobs";
import useOrganization from "@/hooks/useOrganization";

export default function CompletedJobsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { jobs, loading, error } = useJobs();

  if (orgLoading) {
    return <LoadingState message="Loading jobs..." fullScreen />;
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Completed Jobs</h1>
        <p className="text-muted-foreground mt-2">
          View all completed jobs and their submission data
        </p>
      </div>

      <div className="space-y-4">
        <CompletedJobsList jobs={jobs} loading={loading} error={error} />
      </div>
    </>
  );
}
