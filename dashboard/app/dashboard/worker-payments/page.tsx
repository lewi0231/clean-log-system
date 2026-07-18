"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import { PricingScopeProvider } from "@/components/pricing/pricing-scope-context";
import { Button } from "@/components/ui/button";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CalculatePaymentDialog from "@/components/worker-payments/calculate-payment-dialog";
import PaymentHistoryList from "@/components/worker-payments/payment-history-list";
import RateCardManager from "@/components/worker-payments/rate-card-manager";
import TaxInvoiceQueue from "@/components/worker-payments/tax-invoice-queue";
import WorkerPaymentSummary from "@/components/worker-payments/worker-payment-summary";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import {
  WorkerPaymentService,
  type SaveWorkerPaymentResult,
} from "@/lib/services/worker-payment.service";
import { canAdminSeeTaxInvoiceQueue } from "@clean-log/shared/utils/workforce-engagement";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function WorkerPaymentsPage() {
  const { organizationId, userRole, loading: orgLoading, error: orgError } = useOrganization();
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
      <WorkerPaymentsPageContent
        organizationId={organizationId}
        fieldConfigs={fieldConfigs}
        isAdmin={userRole === "admin"}
      />
    </PricingScopeProvider>
  );
}

interface WorkerPaymentsPageContentProps {
  organizationId: string | null;
  fieldConfigs: import("@clean-log/shared/types").FieldConfig[];
  isAdmin: boolean;
}

function WorkerPaymentsPageContent({
  organizationId,
  fieldConfigs,
  isAdmin,
}: WorkerPaymentsPageContentProps) {
  const queryClient = useQueryClient();
  const { jobs } = useJobs();
  const { settings } = useOrganizationSettings();
  const [hasTaxInvoiceHistory, setHasTaxInvoiceHistory] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    void queryClient.invalidateQueries({ queryKey: organizationSettingsKey(organizationId) });
  }, [organizationId, queryClient]);
  const { currency: orgCurrency } = useOrganizationCurrency();
  const { calculatePayments } = useWorkerPayments();
  const { addPayment } = useWorkerPaymentHistory(jobs);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);

  const showTaxInvoicesTab = canAdminSeeTaxInvoiceQueue(
    settings?.workforce_engagement,
    hasTaxInvoiceHistory
  );

  const jobsWithWorkers = jobs.filter((job) => job.workers.length > 0);

  const handleCalculatePayments = async (
    jobIds: string[],
    options?: { replaceExisting?: boolean }
  ): Promise<SaveWorkerPaymentResult | undefined> => {
    if (!organizationId) return undefined;

    const result = await calculatePayments(jobIds);
    if (!result?.calculation) return undefined;

    try {
      const outcome = await WorkerPaymentService.savePayment(
        organizationId,
        result,
        jobIds,
        options
      );

      if (outcome.ok) {
        addPayment(result, jobIds);
      }

      return outcome;
    } catch (error) {
      log.error("Failed to save payment:", error);
      throw error;
    }
  };

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Worker Payments</h1>
          <p className="text-muted-foreground mt-2">
            Calculate, view, and manage what workers are owed for completed jobs. Amounts use the
            worker side of the rules in{" "}
            <Link
              href="/dashboard/pricing"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Pricing
            </Link>
            .
          </p>
        </div>
        <ContextualHelp label="Worker payments" className="shrink-0 mt-1">
          <p>
            Tally calculates payment amounts and records pay runs; it does <strong>not</strong>{" "}
            transfer money to workers.
          </p>
          {orgCurrency !== "AUD" && (
            <p>
              If you operate outside Australia, verify local wage, contractor, and record-keeping
              rules independently—Tally does not provide jurisdiction-specific compliance advice.
            </p>
          )}
          <p>
            <strong>Summary</strong> shows who is owed in the current pay period, earlier unpaid
            runs, and lets you <strong>mark as paid</strong> after you pay out.{" "}
            <strong>History</strong> is a read-only log of past pay runs. Use{" "}
            <strong>Calculate Payments</strong> to run numbers for the jobs you select.
          </p>
          <p>
            Optional <strong>Rate cards</strong> (tab below) add per-worker modifiers (bonuses,
            multipliers, etc.) when payments are calculated.
          </p>
          <p>
            This area does <strong>not</strong> run payroll or guarantee compliance with awards, the
            NES, or minimum wages. In Australia, see the{" "}
            <a
              href="https://www.fairwork.gov.au/pay-and-wages/minimum-wages/piece-rates-and-commission-payments"
              className="text-primary font-medium underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fair Work Ombudsman
            </a>{" "}
            for high-level context on piece rates and similar arrangements; verify your obligations
            with a qualified payroll or legal adviser.
          </p>
        </ContextualHelp>
      </div>

      <div className="flex items-center justify-end mb-6">
        <Button
          onClick={() => setIsCalculateDialogOpen(true)}
          disabled={jobsWithWorkers.length === 0}
          className="cursor-pointer"
        >
          <Calculator className="mr-2 h-4 w-4" />
          Calculate Payments
        </Button>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="summary" className="cursor-pointer">
            Summary
          </TabsTrigger>
          <TabsTrigger value="history" className="cursor-pointer">
            History
          </TabsTrigger>
          <TabsTrigger value="rate-cards" className="cursor-pointer">
            Rate Cards
          </TabsTrigger>
          {showTaxInvoicesTab && (
            <TabsTrigger value="tax-invoices" className="cursor-pointer">
              Tax invoices
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <WorkerPaymentSummary jobs={jobs} organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <PaymentHistoryList jobs={jobs} organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="rate-cards" className="space-y-6">
          <RateCardManager fieldConfigs={fieldConfigs} />
        </TabsContent>

        {showTaxInvoicesTab && organizationId && (
          <TabsContent value="tax-invoices" className="space-y-6">
            <TaxInvoiceQueue
              organizationId={organizationId}
              isAdmin={isAdmin}
              onHistoryPresenceChange={setHasTaxInvoiceHistory}
            />
          </TabsContent>
        )}
      </Tabs>

      {!showTaxInvoicesTab && organizationId && (
        <TaxInvoiceHistoryProbe
          organizationId={organizationId}
          onHistoryPresenceChange={setHasTaxInvoiceHistory}
        />
      )}

      <CalculatePaymentDialog
        open={isCalculateDialogOpen}
        onOpenChange={setIsCalculateDialogOpen}
        onCalculate={handleCalculatePayments}
        jobs={jobs}
      />
    </>
  );
}

/** Lightweight list call so employees-mode orgs still unlock the tab when history exists. */
function TaxInvoiceHistoryProbe({
  organizationId,
  onHistoryPresenceChange,
}: {
  organizationId: string;
  onHistoryPresenceChange: (hasRows: boolean) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { WorkerTaxInvoiceService } =
          await import("@/lib/services/worker-tax-invoice.service");
        const rows = await WorkerTaxInvoiceService.list(organizationId);
        if (!cancelled) onHistoryPresenceChange(rows.length > 0);
      } catch {
        /* ignore — tab stays hidden until engagement allows it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, onHistoryPresenceChange]);

  return null;
}
