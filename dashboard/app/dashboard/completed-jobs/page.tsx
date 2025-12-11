"use client";

import CompletedJobsList from "@/components/completed-jobs/completed-jobs-list";
import CreateJobDialog from "@/components/completed-jobs/create-job-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import CalculatePaymentDialog from "@/components/worker-payments/calculate-payment-dialog";
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationUsers } from "@/hooks/use-organization-users";
import useAuth from "@/hooks/useAuth";
import useOrganization from "@/hooks/useOrganization";
import { Job } from "@/lib/types";
import {
  ArrowUpDown,
  Calculator,
  Calendar,
  MapPin,
  Plus,
  User,
} from "lucide-react";
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
  const [isCalculatePaymentDialogOpen, setIsCalculatePaymentDialogOpen] =
    useState(false);
  const [sortBy, setSortBy] = useState<
    "date" | "location" | "worker" | "status"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    if (!user?.email || !organizationUsers.length) return false;
    const currentUser = organizationUsers.find((ou) => ou.email === user.email);
    return currentUser?.role === "admin";
  }, [user, organizationUsers]);

  // Calculate job status for sorting
  const getJobStatus = (job: Job): string => {
    const invoices = job.invoice_job?.filter((ij) => ij.invoice !== null) || [];
    if (invoices.length === 0) return "not_invoiced";

    // Get the most recent invoice (if multiple, use the first one)
    const invoice = invoices[0]?.invoice;
    if (!invoice) return "not_invoiced";

    if (invoice.paid_at) return "paid";
    return invoice.status;
  };

  // Sort jobs based on selected criteria
  const sortedJobs = useMemo(() => {
    const jobsCopy = [...jobs];

    return jobsCopy.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.completed_at).getTime() -
            new Date(b.completed_at).getTime();
          break;
        case "location":
          const locationA = a.location?.name || "";
          const locationB = b.location?.name || "";
          comparison = locationA.localeCompare(locationB);
          break;
        case "worker":
          const workerA = a.workers[0]?.name || "";
          const workerB = b.workers[0]?.name || "";
          comparison = workerA.localeCompare(workerB);
          break;
        case "status":
          const statusA = getJobStatus(a);
          const statusB = getJobStatus(b);
          // Status priority: paid > sent > draft > overdue > cancelled > not_invoiced
          const statusPriority: Record<string, number> = {
            paid: 1,
            sent: 2,
            draft: 3,
            overdue: 4,
            cancelled: 5,
            not_invoiced: 6,
          };
          comparison =
            (statusPriority[statusA] || 99) - (statusPriority[statusB] || 99);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [jobs, sortBy, sortOrder]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc");
    }
  };

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
    <div className=" w-full max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Completed Jobs</h1>
          <p className="text-muted-foreground mt-2">
            View all completed jobs and their submission data
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCalculatePaymentDialogOpen(true)}
            >
              <Calculator className="mr-2 h-4 w-4" />
              Calculate Payments
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Sort controls */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={sortBy === "date" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("date")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Sort by Date{" "}
            {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
          </Button>
          <Button
            variant={sortBy === "location" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("location")}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Sort by Location{" "}
            {sortBy === "location" && (sortOrder === "desc" ? "↓" : "↑")}
          </Button>
          <Button
            variant={sortBy === "worker" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("worker")}
          >
            <User className="mr-2 h-4 w-4" />
            Sort by Worker{" "}
            {sortBy === "worker" && (sortOrder === "desc" ? "↓" : "↑")}
          </Button>
          <Button
            variant={sortBy === "status" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("status")}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Sort by Status{" "}
            {sortBy === "status" && (sortOrder === "desc" ? "↓" : "↑")}
          </Button>
        </div>

        <CompletedJobsList
          jobs={sortedJobs}
          loading={loading}
          error={error}
          isAdmin={isAdmin}
          onJobUpdated={refetch}
        />
      </div>

      <CreateJobDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
        }}
      />

      <CalculatePaymentDialog
        open={isCalculatePaymentDialogOpen}
        onOpenChange={setIsCalculatePaymentDialogOpen}
        onCalculate={async () => {
          // Payment calculation completed
        }}
      />
    </div>
  );
}
