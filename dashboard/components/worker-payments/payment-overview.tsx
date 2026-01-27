"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { Job } from "@/lib/types";
import { Briefcase, DollarSign, Users } from "lucide-react";
import { useMemo } from "react";

interface PaymentOverviewProps {
  jobs: Job[];
}

export default function PaymentOverview({ jobs }: PaymentOverviewProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { paymentHistory } = useWorkerPaymentHistory(jobs);

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
    </>
  );
}
