"use client";

import { PricingScopeProvider } from "@/components/pricing/pricing-scope-context";
import { ErrorState } from "@/components/ui/error-state";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PaymentHistoryList from "@/components/worker-payments/payment-history-list";
import PaymentOverview from "@/components/worker-payments/payment-overview";
import WorkerPaymentSummary from "@/components/worker-payments/worker-payment-summary";
import useOrganization from "@/hooks/useOrganization";

export default function WorkerPaymentsPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();

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
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <PricingScopeProvider>
      <WorkerPaymentsPageContent />
    </PricingScopeProvider>
  );
}

function WorkerPaymentsPageContent() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Worker Payments</h1>
        <p className="text-muted-foreground mt-2">
          Calculate, view, and manage worker payments for completed jobs. Worker
          payments are calculated based on the pricing rules configured in the
          Pricing section.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Payment Overview</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="worker-summary">Worker Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PaymentOverview />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <PaymentHistoryList />
        </TabsContent>

        <TabsContent value="worker-summary" className="space-y-6">
          <WorkerPaymentSummary />
        </TabsContent>
      </Tabs>
    </>
  );
}
