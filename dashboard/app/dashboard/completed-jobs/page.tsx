"use client";

import CompletedJobsList from "@/components/completed-jobs/completed-jobs-list";
import CreateJobDialog from "@/components/completed-jobs/create-job-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { CompletedJobsSkeleton } from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import CalculatePaymentDialog from "@/components/worker-payments/calculate-payment-dialog";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationUsers } from "@/hooks/use-organization-users";
import { useAuth } from "@/hooks/useAuth";
import useOrganization from "@/hooks/useOrganization";
import { ArrowUpDown, Calculator, Calendar, MapPin, Plus, User } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function CompletedJobsPage() {
  const searchParams = useSearchParams();
  const focusJobIdFromQuery = searchParams.get("job");
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();
  const [showTests, setShowTests] = useState(false);
  const { jobs, loading, error, refetch, createJob, updateJob, getJobEdits, sendFeedbackEmail } =
    useJobs({
      includeTests: showTests,
    });
  const { user } = useAuth();
  const { organizationUsers } = useOrganizationUsers();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCalculatePaymentDialogOpen, setIsCalculatePaymentDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "location" | "worker" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    if (!user?.email || !organizationUsers.length) return false;
    const email = user.email.trim().toLowerCase();
    const currentUser = organizationUsers.find((ou) => ou.email.trim().toLowerCase() === email);
    return currentUser?.role === "admin";
  }, [user, organizationUsers]);

  // Job-level invoice status for sorting: not_invoiced | invoice_created
  const getJobInvoiceStatus = (job: {
    invoice_job?: Array<{ invoice: unknown } | null> | null;
  }): "not_invoiced" | "invoice_created" => {
    const invoices = job.invoice_job?.filter((ij) => ij?.invoice !== null) ?? [];
    return invoices.length === 0 ? "not_invoiced" : "invoice_created";
  };

  // Sort jobs based on selected criteria
  const sortedJobs = useMemo(() => {
    const jobsCopy = [...jobs];

    return jobsCopy.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison = new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
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
          // not_invoiced = 0, invoice_created = 1; desc = invoice_created first
          const statusOrder = { not_invoiced: 0, invoice_created: 1 };
          comparison = statusOrder[getJobInvoiceStatus(a)] - statusOrder[getJobInvoiceStatus(b)];
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
    return <CompletedJobsSkeleton />;
  }

  if (orgError || !organizationId) {
    return <ErrorState message={orgError || "Failed to load organization"} fullScreen />;
  }

  return (
    <div className="w-[calc(100vw-360px)]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Completed Jobs</h1>
          <p className="text-muted-foreground mt-2">
            View all completed jobs and their submission data
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCalculatePaymentDialogOpen(true)}>
              <Calculator className="mr-2 h-4 w-4 cursor-pointer" />
              Calculate Payments
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4 cursor-pointer" />
              Create Job
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Sort controls */}
        <div className="flex gap-2 flex-wrap items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={sortBy === "date" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("date")}
              className="cursor-pointer"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Sort by Date {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
            </Button>
            <Button
              variant={sortBy === "location" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("location")}
              className="cursor-pointer"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Sort by Location {sortBy === "location" && (sortOrder === "desc" ? "↓" : "↑")}
            </Button>
            <Button
              variant={sortBy === "worker" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("worker")}
              className="cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              Sort by Worker {sortBy === "worker" && (sortOrder === "desc" ? "↓" : "↑")}
            </Button>
            <Button
              variant={sortBy === "status" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("status")}
              className="cursor-pointer"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Sort by Status {sortBy === "status" && (sortOrder === "desc" ? "↓" : "↑")}
            </Button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Label htmlFor="show-test-jobs" className="text-sm">
                Show test data
              </Label>
              <Switch id="show-test-jobs" checked={showTests} onCheckedChange={setShowTests} />
            </div>
          )}
        </div>

        <CompletedJobsList
          key={focusJobIdFromQuery ?? "all-jobs"}
          jobs={sortedJobs}
          loading={loading}
          error={error}
          isAdmin={isAdmin}
          onJobUpdated={refetch}
          updateJob={updateJob}
          getJobEdits={getJobEdits}
          sendFeedbackEmail={sendFeedbackEmail}
          organizationId={organizationId}
          fieldConfigs={fieldConfigs}
          focusJobId={focusJobIdFromQuery}
        />
      </div>

      <CreateJobDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
        }}
        createJob={createJob}
        organizationId={organizationId}
        fieldConfigs={fieldConfigs}
      />

      <CalculatePaymentDialog
        open={isCalculatePaymentDialogOpen}
        onOpenChange={setIsCalculatePaymentDialogOpen}
        onCalculate={async () => {
          // Payment calculation completed
        }}
        jobs={jobs}
      />
    </div>
  );
}
