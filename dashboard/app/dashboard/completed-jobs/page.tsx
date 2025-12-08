"use client";

import CompletedJobsList from "@/components/completed-jobs/completed-jobs-list";
import CreateJobDialog from "@/components/completed-jobs/create-job-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationUsers } from "@/hooks/use-organization-users";
import useAuth from "@/hooks/useAuth";
import useOrganization from "@/hooks/useOrganization";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export default function CompletedJobsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { jobs, loading, error, refetch } = useJobs();
  const { user } = useAuth();
  const { organizationUsers } = useOrganizationUsers();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    if (!user?.email || !organizationUsers.length) return false;
    const currentUser = organizationUsers.find((ou) => ou.email === user.email);
    return currentUser?.role === "admin";
  }, [user, organizationUsers]);

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Completed Jobs</h1>
          <p className="text-muted-foreground mt-2">
            View all completed jobs and their submission data
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <CompletedJobsList jobs={jobs} loading={loading} error={error} />
      </div>

      <CreateJobDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
        }}
      />
    </>
  );
}
