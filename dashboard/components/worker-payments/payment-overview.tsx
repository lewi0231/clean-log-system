"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import useOrganization from "@/hooks/useOrganization";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { Briefcase, Calculator, DollarSign, Users } from "lucide-react";
import { useMemo, useState } from "react";
import CalculatePaymentDialog from "./calculate-payment-dialog";

export default function PaymentOverview() {
  const { organizationId } = useOrganization();
  const { jobs } = useJobs();
  const { formatCurrency } = useOrganizationCurrency();
  const { calculatePayments, loading: calculating } = useWorkerPayments();
  const { paymentHistory, addPayment } = useWorkerPaymentHistory();
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);

  // Get unique workers from jobs
  const uniqueWorkers = useMemo(() => {
    const workerSet = new Set<string>();
    jobs.forEach((job) => {
      job.workers.forEach((worker) => {
        workerSet.add(worker.id);
      });
    });
    return workerSet.size;
  }, [jobs]);

  // Get jobs with workers
  const jobsWithWorkers = useMemo(() => {
    return jobs.filter((job) => job.workers.length > 0);
  }, [jobs]);

  const handleCalculatePayments = async (jobIds: string[]) => {
    if (!organizationId) return;

    const result = await calculatePayments(jobIds);
    if (result?.calculation) {
      // Save to database via service
      try {
        await WorkerPaymentService.savePayment(organizationId, result, jobIds);
        // Payment saved to database with batch_id
        // TODO: Update useWorkerPaymentHistory to fetch from database instead of localStorage
        // For now, localStorage records won't have batch_id, but database records will
        addPayment(result, jobIds);
      } catch (error) {
        console.error("Failed to save payment:", error);
        // Still add to local state for now, but log error
        addPayment(result, jobIds);
      }
    }
  };

  // Get latest payment calculation for display
  const latestPayment = useMemo(() => {
    if (paymentHistory.length === 0) return null;
    const latest = paymentHistory[0];
    const uniqueWorkers = new Set<string>();
    jobs
      .filter((job) => latest.jobIds.includes(job.id))
      .forEach((job) => {
        job.workers.forEach((worker) => {
          uniqueWorkers.add(worker.id);
        });
      });
    return {
      total: latest.totalPayment,
      jobCount: latest.jobIds.length,
      workerCount: uniqueWorkers.size,
    };
  }, [paymentHistory, jobs]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" />
        <Button
          onClick={() => setIsCalculateDialogOpen(true)}
          disabled={calculating || jobsWithWorkers.length === 0}
        >
          <Calculator className="mr-2 h-4 w-4" />
          Calculate Payments
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Worker Payments
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestPayment
                ? formatCurrency(latestPayment.total)
                : formatCurrency(0)}
            </div>
            <CardDescription className="text-xs mt-1">
              {latestPayment
                ? `From ${latestPayment.jobCount} job(s)`
                : "Calculate payments to see total"}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Workers with Jobs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueWorkers}</div>
            <CardDescription className="text-xs mt-1">
              {jobsWithWorkers.length} job(s) with workers assigned
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Payment per Job
            </CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestPayment && latestPayment.jobCount > 0
                ? formatCurrency(latestPayment.total / latestPayment.jobCount)
                : formatCurrency(0)}
            </div>
            <CardDescription className="text-xs mt-1">
              {latestPayment
                ? `Based on ${latestPayment.jobCount} job(s)`
                : "Calculate payments to see average"}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Payment per Worker
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestPayment && latestPayment.workerCount > 0
                ? formatCurrency(
                    latestPayment.total / latestPayment.workerCount
                  )
                : formatCurrency(0)}
            </div>
            <CardDescription className="text-xs mt-1">
              {latestPayment
                ? `Across ${latestPayment.workerCount} worker(s)`
                : "Calculate payments to see average"}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {latestPayment && (
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Last Calculation</CardTitle>
            <CardDescription>
              Payment calculation completed successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Payment:</span>
                <span className="font-medium">
                  {formatCurrency(latestPayment.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jobs Included:</span>
                <span className="font-medium">{latestPayment.jobCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Workers:</span>
                <span className="font-medium">{latestPayment.workerCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <CalculatePaymentDialog
        open={isCalculateDialogOpen}
        onOpenChange={setIsCalculateDialogOpen}
        onCalculate={handleCalculatePayments}
      />
    </>
  );
}
