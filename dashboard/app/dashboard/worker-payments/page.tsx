"use client";

import { PricingScopeProvider } from "@/components/pricing/pricing-scope-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CalculatePaymentDialog from "@/components/worker-payments/calculate-payment-dialog";
import PaymentHistoryList from "@/components/worker-payments/payment-history-list";
import PaymentOverview from "@/components/worker-payments/payment-overview";
import RateCardManager from "@/components/worker-payments/rate-card-manager";
import WorkerPaymentSummary from "@/components/worker-payments/worker-payment-summary";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useJobs } from "@/hooks/use-jobs";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { Calculator } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WorkerPaymentsPage() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <TableSkeleton rows={5} columns={4} />
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return <ErrorState message={orgError || "Failed to load organization"} fullScreen />;
  }

  return (
    <PricingScopeProvider fieldConfigs={fieldConfigs}>
      <WorkerPaymentsPageContent organizationId={organizationId} fieldConfigs={fieldConfigs} />
    </PricingScopeProvider>
  );
}

interface WorkerPaymentsPageContentProps {
  organizationId: string | null;
  fieldConfigs: import("@clean-log/shared/types").FieldConfig[];
}

function WorkerPaymentsPageContent({
  organizationId,
  fieldConfigs,
}: WorkerPaymentsPageContentProps) {
  const { jobs } = useJobs();
  const { calculatePayments } = useWorkerPayments();
  const { addPayment } = useWorkerPaymentHistory(jobs);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);

  // Get jobs with workers
  const jobsWithWorkers = jobs.filter((job) => job.workers.length > 0);

  const handleCalculatePayments = async (jobIds: string[]) => {
    if (!organizationId) return;

    const result = await calculatePayments(jobIds);
    if (result?.calculation) {
      // Save to database via service
      try {
        await WorkerPaymentService.savePayment(organizationId, result, jobIds);
        addPayment(result, jobIds);
      } catch (error) {
        log.error("Failed to save payment:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save payment. Showing results locally."
        );
        // Still add to local state for now
        addPayment(result, jobIds);
      }
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Worker Payments</h1>
        <p className="text-muted-foreground mt-2">
          Calculate, view, and manage worker payments for completed jobs. Worker payments are
          calculated based on the pricing rules configured in the Pricing section.
        </p>
      </div>

      <Alert className="mb-6 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
        <AlertDescription>
          Worker payment splits allocate the priced worker total among your team. They do not
          replace Australian award, NES, or minimum pay obligations. See the{" "}
          <a
            href="https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments"
            className="underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Fair Work Ombudsman — piece rates and commission
          </a>{" "}
          for context. Verify payroll compliance outside this app.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-end mb-6">
        <Button
          onClick={() => setIsCalculateDialogOpen(true)}
          disabled={jobsWithWorkers.length === 0}
        >
          <Calculator className="mr-2 h-4 w-4" />
          Calculate Payments
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Payment Overview</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="worker-summary">Worker Summary</TabsTrigger>
          <TabsTrigger value="rate-cards">Rate Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PaymentOverview jobs={jobs} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <PaymentHistoryList jobs={jobs} organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="worker-summary" className="space-y-6">
          <WorkerPaymentSummary jobs={jobs} />
        </TabsContent>

        <TabsContent value="rate-cards" className="space-y-6">
          <RateCardManager fieldConfigs={fieldConfigs} />
        </TabsContent>
      </Tabs>

      <CalculatePaymentDialog
        open={isCalculateDialogOpen}
        onOpenChange={setIsCalculateDialogOpen}
        onCalculate={handleCalculatePayments}
        jobs={jobs}
      />
    </>
  );
}
