"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import {
  WorkerPaymentService,
  type WorkerSummaryWithBatches,
} from "@/lib/services/worker-payment.service";
import { Job } from "@/lib/types";
import { classifyBatchPayPeriod, isUnpaidPayRun } from "@/lib/worker-payments/batch-period";
import {
  formatShortCalendarRange,
  getCurrentPayPeriodRange,
} from "@/lib/worker-payments/org-pay-period";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkPayRunChoiceDialog, type MarkPayRunChoiceOption } from "./mark-pay-run-choice-dialog";
import MarkPaymentPaidDialog from "./mark-payment-paid-dialog";
import MarkWorkerLinesPaidDialog from "./mark-worker-lines-paid-dialog";
import { PayPeriodSummaryBanner } from "./pay-period-summary-banner";
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
  organizationId: string | null;
}

function batchDateRangeLabel(p: PaymentRecord): string {
  return `${format(new Date(p.dateRange.start), "MMM d, yyyy")} – ${format(
    new Date(p.dateRange.end),
    "MMM d, yyyy"
  )}`;
}

export default function WorkerPaymentSummary({ jobs, organizationId }: WorkerPaymentSummaryProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { settings } = useOrganizationSettings();
  const { paymentHistory, invalidate } = useWorkerPaymentHistory(jobs);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [markBatchId, setMarkBatchId] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [markChoiceOpen, setMarkChoiceOpen] = useState(false);
  const [markChoiceWorkerName, setMarkChoiceWorkerName] = useState("");
  const [markChoiceOptions, setMarkChoiceOptions] = useState<MarkPayRunChoiceOption[] | null>(null);
  const [markLinesOpen, setMarkLinesOpen] = useState(false);
  /** One or more pay runs whose unpaid lines are merged for the worker in `MarkWorkerLinesPaidDialog`. */
  const [markLinesBatches, setMarkLinesBatches] = useState<PaymentRecord[] | null>(null);
  const [markLinesWorkerId, setMarkLinesWorkerId] = useState<string | null>(null);
  const [markLinesWorkerName, setMarkLinesWorkerName] = useState("");

  const currentPeriod = useMemo(
    () => getCurrentPayPeriodRange(settings?.worker_payment_cycle_config ?? null, {}),
    [settings?.worker_payment_cycle_config]
  );

  const currentPeriodHeading = useMemo(
    () => formatShortCalendarRange(currentPeriod.from, currentPeriod.to, currentPeriod.timeZone),
    [currentPeriod]
  );

  const { arrearBatches, currentBatches } = useMemo(() => {
    const unpaid = paymentHistory.filter(isUnpaidPayRun);
    const arrear: PaymentRecord[] = [];
    const current: PaymentRecord[] = [];
    for (const p of unpaid) {
      if (classifyBatchPayPeriod(p, currentPeriod) === "arrears") {
        arrear.push(p);
      } else {
        current.push(p);
      }
    }
    return { arrearBatches: arrear, currentBatches: current };
  }, [paymentHistory, currentPeriod]);

  const currentWorkerSummary = useMemo(() => {
    if (currentBatches.length === 0) return [];
    return WorkerPaymentService.aggregateByWorkerWithBatches(currentBatches, jobs);
  }, [currentBatches, jobs]);

  const sortedWorkerSummary = useMemo(() => {
    const sorted = [...currentWorkerSummary];
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
  }, [currentWorkerSummary, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  const handleViewDetails = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsDetailDialogOpen(true);
  };

  const findBatch = (batchKey: string): PaymentRecord | undefined =>
    paymentHistory.find((p) => (p.batch_id ?? p.id) === batchKey);

  const workerUnpaidInBatch = (batch: PaymentRecord, workerId: string): number => {
    const [row] = WorkerPaymentService.aggregateByWorkerWithBatches([batch], jobs).filter(
      (w) => w.workerId === workerId
    );
    return row?.totalPayment ?? 0;
  };

  const openMarkPaid = (batchKey: string) => {
    setMarkBatchId(batchKey);
    setMarkOpen(true);
  };

  const openMarkForWorker = (row: WorkerSummaryWithBatches) => {
    const keys = row.sourceBatchKeys;
    if (keys.length === 0) return;
    if (keys.length === 1) {
      const only = keys[0];
      if (only) {
        const batch = findBatch(only);
        if (batch) {
          setMarkLinesBatches([batch]);
          setMarkLinesWorkerId(row.workerId);
          setMarkLinesWorkerName(row.workerName);
          setMarkLinesOpen(true);
        }
      }
      return;
    }
    const options: MarkPayRunChoiceOption[] = keys.map((batchId) => {
      const batch = findBatch(batchId);
      return {
        batchId,
        rangeLabel: batch ? batchDateRangeLabel(batch) : batchId,
        amount: batch ? workerUnpaidInBatch(batch, row.workerId) : 0,
      };
    });
    setMarkChoiceWorkerName(row.workerName);
    setMarkLinesWorkerId(row.workerId);
    setMarkChoiceOptions(options);
    setMarkChoiceOpen(true);
  };

  const handleMarkChoiceContinue = (batchIds: string[]) => {
    setMarkChoiceOpen(false);
    const batches = batchIds
      .map((id) => findBatch(id))
      .filter((b): b is PaymentRecord => Boolean(b));
    if (batches.length > 0 && markLinesWorkerId) {
      setMarkLinesBatches(batches);
      setMarkLinesWorkerName(markChoiceWorkerName);
      setMarkLinesOpen(true);
    }
    setMarkChoiceOptions(null);
  };

  const currentTotals = useMemo(() => {
    return {
      workers: currentWorkerSummary.length,
      jobs: currentWorkerSummary.reduce((s, w) => s + w.jobCount, 0),
      total: currentWorkerSummary.reduce((s, w) => s + w.totalPayment, 0),
    };
  }, [currentWorkerSummary]);

  return (
    <>
      <div className="space-y-10">
        <PayPeriodSummaryBanner />

        {arrearBatches.length > 0 && (
          <div className="space-y-8">
            {arrearBatches.map((batch) => {
              const byWorker = WorkerPaymentService.aggregateByWorkerWithBatches([batch], jobs);
              return (
                <section key={batch.id} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {batchDateRangeLabel(batch)}
                    </h3>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => handleViewDetails(batch)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View run
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => openMarkPaid(batch.batch_id ?? batch.id)}
                      >
                        Mark as paid
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Run total {formatCurrency(batch.totalPayment)} · {byWorker.length} worker
                    {byWorker.length === 1 ? "" : "s"}
                  </p>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker</TableHead>
                          <TableHead className="text-right">Jobs</TableHead>
                          <TableHead className="text-right">Unpaid</TableHead>
                          <TableHead className="text-right">Avg / job</TableHead>
                          <TableHead className="text-right w-[140px]">Settle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byWorker.map((row) => (
                          <TableRow key={row.workerId}>
                            <TableCell className="font-medium">{row.workerName}</TableCell>
                            <TableCell className="text-right">{row.jobCount}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row.totalPayment)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatCurrency(row.averagePayment)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="cursor-pointer"
                                onClick={() => {
                                  setMarkLinesBatches([batch]);
                                  setMarkLinesWorkerId(row.workerId);
                                  setMarkLinesWorkerName(row.workerName);
                                  setMarkLinesOpen(true);
                                }}
                              >
                                Mark as paid
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <section className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">{currentPeriodHeading}</h3>
          <p className="text-sm text-muted-foreground">
            Current pay period. Unpaid pay runs are attributed by the latest job completion in each
            run. Mark as paid after you pay out in your bank or payroll.
          </p>
          {currentBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outstanding pay runs in this period. Use <strong>Calculate Payments</strong> when
              you are ready to record a new run.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {currentTotals.workers} worker{currentTotals.workers === 1 ? "" : "s"} ·{" "}
                {currentTotals.jobs} job line{currentTotals.jobs === 1 ? "" : "s"} ·{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(currentTotals.total)} unpaid
                </span>
              </p>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          className={cn(
                            "flex items-center cursor-pointer hover:text-foreground transition-colors",
                            sortField === "name" && "text-foreground"
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
                            "flex items-center justify-end w-full cursor-pointer hover:text-foreground transition-colors",
                            sortField === "jobs" && "text-foreground"
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
                            "flex items-center justify-end w-full cursor-pointer hover:text-foreground transition-colors",
                            sortField === "total" && "text-foreground"
                          )}
                        >
                          Unpaid
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
                            "flex items-center justify-end w-full cursor-pointer hover:text-foreground transition-colors",
                            sortField === "average" && "text-foreground"
                          )}
                        >
                          Avg / job
                          <SortIcon
                            field="average"
                            sortField={sortField}
                            sortDirection={sortDirection}
                          />
                        </button>
                      </TableHead>
                      <TableHead className="text-right w-[180px]">Settle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWorkerSummary.map((row) => {
                      const viewBatch = findBatch(row.sourceBatchKeys[0] ?? "");
                      return (
                        <TableRow key={row.workerId}>
                          <TableCell className="font-medium">{row.workerName}</TableCell>
                          <TableCell className="text-right">{row.jobCount}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(row.totalPayment)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatCurrency(row.averagePayment)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:items-center">
                              {viewBatch && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="cursor-pointer"
                                  onClick={() => handleViewDetails(viewBatch)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="cursor-pointer"
                                onClick={() => openMarkForWorker(row)}
                              >
                                Mark as paid
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>
      </div>

      {selectedPayment && (
        <PaymentDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          payment={selectedPayment}
          jobs={jobs}
        />
      )}

      {markChoiceOptions && (
        <MarkPayRunChoiceDialog
          open={markChoiceOpen}
          onOpenChange={(open) => {
            setMarkChoiceOpen(open);
            if (!open) setMarkChoiceOptions(null);
          }}
          workerName={markChoiceWorkerName}
          options={markChoiceOptions}
          onContinue={handleMarkChoiceContinue}
        />
      )}

      {markBatchId && (
        <MarkPaymentPaidDialog
          open={markOpen}
          onOpenChange={(open) => {
            setMarkOpen(open);
            if (!open) setMarkBatchId(null);
          }}
          batchId={markBatchId}
          onSuccess={() => {
            void invalidate();
          }}
          organizationId={organizationId}
        />
      )}

      {markLinesBatches && markLinesBatches.length > 0 && markLinesWorkerId && (
        <MarkWorkerLinesPaidDialog
          open={markLinesOpen}
          onOpenChange={(open) => {
            setMarkLinesOpen(open);
            if (!open) {
              setMarkLinesBatches(null);
              setMarkLinesWorkerId(null);
              setMarkLinesWorkerName("");
            }
          }}
          batches={markLinesBatches}
          workerId={markLinesWorkerId}
          workerName={markLinesWorkerName}
          jobs={jobs}
          organizationId={organizationId}
          onSuccess={() => {
            void invalidate();
          }}
        />
      )}
    </>
  );
}
