"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { useWorkerPaymentSummary } from "@/hooks/use-worker-payment-summary";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calculator,
  Eye,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import PaymentDetailDialog from "./payment-detail-dialog";

type SortField = "name" | "jobs" | "total" | "average";
type SortDirection = "asc" | "desc";

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
  }
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  );
}

interface WorkerPaymentSummaryProps {
  jobs: Job[];
}

export default function WorkerPaymentSummary({
  jobs,
}: WorkerPaymentSummaryProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { paymentHistory } = useWorkerPaymentHistory(jobs);
  const { workerSummary } = useWorkerPaymentSummary(jobs);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(
    null,
  );
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Sort worker summaries
  const sortedWorkerSummary = useMemo(() => {
    const sorted = [...workerSummary];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.workerName.localeCompare(b.workerName);
          break;
        case "jobs":
          comparison = a.jobCount - b.jobCount;
          break;
        case "total":
          comparison = a.totalPayment - b.totalPayment;
          break;
        case "average":
          comparison = a.averagePayment - b.averagePayment;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [workerSummary, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return {
      workers: workerSummary.length,
      jobs: workerSummary.reduce((sum, s) => sum + s.jobCount, 0),
      totalPayment: workerSummary.reduce((sum, s) => sum + s.totalPayment, 0),
    };
  }, [workerSummary]);

  const handleViewDetails = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsDetailDialogOpen(true);
  };

  return (
    <>
      {/* Summary Stats */}
      {workerSummary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Workers</p>
                  <p className="text-2xl font-bold">{totals.workers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Calculator className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{totals.jobs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-500 font-bold">$</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Payments
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totals.totalPayment)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Worker Payment Summary</CardTitle>
          <CardDescription>
            Payments grouped by worker with totals and averages. Click column
            headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workerSummary.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No payment calculations yet. Click &apos;Calculate Payments&apos;
              to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className={cn(
                        "flex items-center hover:text-foreground transition-colors",
                        sortField === "name" && "text-foreground",
                      )}
                    >
                      Worker
                      <SortIcon
                        field="name"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("jobs")}
                      className={cn(
                        "flex items-center justify-end w-full hover:text-foreground transition-colors",
                        sortField === "jobs" && "text-foreground",
                      )}
                    >
                      Jobs
                      <SortIcon
                        field="jobs"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("total")}
                      className={cn(
                        "flex items-center justify-end w-full hover:text-foreground transition-colors",
                        sortField === "total" && "text-foreground",
                      )}
                    >
                      Total Payment
                      <SortIcon
                        field="total"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("average")}
                      className={cn(
                        "flex items-center justify-end w-full hover:text-foreground transition-colors",
                        sortField === "average" && "text-foreground",
                      )}
                    >
                      Average per Job
                      <SortIcon
                        field="average"
                        sortField={sortField}
                        sortDirection={sortDirection}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedWorkerSummary.map((summary) => {
                  // Find the most recent payment record that includes this worker
                  const relatedPayment = paymentHistory.find((p) =>
                    summary.jobs.some((jobId) => p.jobIds.includes(jobId)),
                  );

                  return (
                    <TableRow key={summary.workerId}>
                      <TableCell className="font-medium">
                        {summary.workerName}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.jobCount}
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono">
                        {formatCurrency(summary.totalPayment)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(summary.averagePayment)}
                      </TableCell>
                      <TableCell className="text-right">
                        {relatedPayment && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(relatedPayment)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedPayment && (
        <PaymentDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          payment={selectedPayment}
          jobs={jobs}
        />
      )}
    </>
  );
}
