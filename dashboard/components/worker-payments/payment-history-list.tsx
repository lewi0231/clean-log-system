"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Job } from "@/lib/types";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { getWorkerSettlementStatus } from "@/lib/worker-payments/payment-settlement-status";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import PaymentDetailDialog from "./payment-detail-dialog";

interface PaymentHistoryListProps {
  jobs: Job[];
  organizationId: string | null;
}

export default function PaymentHistoryList({ jobs, organizationId }: PaymentHistoryListProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { paymentHistory, filterByDateRange, refetch } = useWorkerPaymentHistory(jobs);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [detailSelection, setDetailSelection] = useState<{
    payment: PaymentRecord;
    workerId: string;
  } | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const filteredHistory = useMemo(() => {
    return filterByDateRange(startDate || undefined, endDate || undefined);
  }, [startDate, endDate, filterByDateRange]);

  const workerHistoryRows = useMemo(() => {
    const rows: {
      key: string;
      payment: PaymentRecord;
      workerId: string;
      workerName: string;
      workerTotal: number;
      settlement: ReturnType<typeof getWorkerSettlementStatus>;
    }[] = [];
    for (const payment of filteredHistory) {
      const pays = payment.payments;
      if (!pays?.length) continue;
      const workerIds = [...new Set(pays.map((p) => p.worker_id))];
      for (const workerId of workerIds) {
        const settlement = getWorkerSettlementStatus(pays, workerId);
        /** History lists workers who have at least one recorded payment line; unpaid-only stays on Summary. */
        if (settlement === "none") continue;

        const workerTotal = pays
          .filter((p) => p.worker_id === workerId)
          .reduce((s, p) => s + p.amount, 0);
        rows.push({
          key: `${payment.id}-${workerId}`,
          payment,
          workerId,
          workerName: WorkerPaymentService.resolveWorkerNameForExport(payment, workerId, jobs),
          workerTotal,
          settlement,
        });
      }
    }
    rows.sort((a, b) => {
      const tb = new Date(b.payment.calculatedAt).getTime();
      const ta = new Date(a.payment.calculatedAt).getTime();
      if (tb !== ta) return tb - ta;
      return a.workerName.localeCompare(b.workerName, undefined, {
        sensitivity: "base",
      });
    });
    return rows;
  }, [filteredHistory, jobs]);

  const handleViewDetails = (row: (typeof workerHistoryRows)[0]) => {
    setDetailSelection({ payment: row.payment, workerId: row.workerId });
    setIsDetailDialogOpen(true);
  };

  /** Batches the API confirmed have zero `worker_payment` rows — export not available. */
  const isOrphanHandoff = (p: PaymentRecord) =>
    Array.isArray(p.payments) && p.payments.length === 0;

  const handleExport = async (payment: PaymentRecord) => {
    if (isOrphanHandoff(payment)) {
      toast.error(
        "This batch has no per-worker lines to export. Contact support with batch id: " +
          (payment.batch_id ?? payment.id)
      );
      return;
    }
    if (!organizationId) {
      toast.error("Organization not loaded; try again.");
      return;
    }

    let batch = payment;
    if (!batch.payments?.length) {
      const res = (await refetch()) as { data?: PaymentRecord[] };
      const list = res.data ?? paymentHistory;
      const match = list.find((p) => p.id === payment.id);
      if (match) batch = match;
    }

    if (!batch.payments?.length) {
      toast.error(
        "Cannot export: no per-worker lines for this batch. If this batch was just saved, wait a moment and try again, or contact support with batch id: " +
          (batch.batch_id ?? batch.id)
      );
      return;
    }

    try {
      const csv = WorkerPaymentService.exportBatchWorkerSummaryToCsv(batch, {
        organizationId,
        jobs,
      });
      const name = `tally-worker-payments-${batch.batch_id ?? batch.id}-${format(new Date(), "yyyy-MM-dd")}.csv`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      if (msg === "EXPORT_NO_LINE_ITEMS") {
        toast.error(
          "Cannot export: no per-worker lines for this batch. Contact support with batch id: " +
            (batch.batch_id ?? batch.id)
        );
      } else if (msg.startsWith("RECONCILE_FAIL")) {
        toast.error(
          "Cannot export: batch total does not match per-worker line items. Contact support with batch id: " +
            (batch.batch_id ?? batch.id)
        );
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            One row per worker per pay run once at least some work is recorded as paid. Unpaid-only
            lines stay on the <strong>Summary</strong> tab. Date filters use each run&apos;s job
            date range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {workerHistoryRows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {paymentHistory.length === 0
                  ? "No payment calculations yet. Click 'Calculate Payments' to get started."
                  : startDate || endDate
                    ? "No payments found for the selected date range."
                    : "No recorded payments to workers yet. When you mark work as paid on the Summary tab, it will appear here."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Pay period</TableHead>
                    <TableHead className="text-right">Amount (worker)</TableHead>
                    <TableHead>Recorded</TableHead>
                    <TableHead>Run calculated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workerHistoryRows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="font-medium">{row.workerName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {row.workerId}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(row.payment.dateRange.start), "MMM d, yyyy")} -{" "}
                        {format(new Date(row.payment.dateRange.end), "MMM d, yyyy")}
                        <div className="text-xs text-muted-foreground">
                          {row.payment.jobIds.length} job
                          {row.payment.jobIds.length === 1 ? "" : "s"} in run
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono">
                        {formatCurrency(row.workerTotal)}
                      </TableCell>
                      <TableCell>
                        {row.settlement === "complete" && (
                          <span className="text-sm">Paid in full</span>
                        )}
                        {row.settlement === "partial" && (
                          <span className="text-sm">Partly paid</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(row.payment.calculatedAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => handleViewDetails(row)}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            disabled={isOrphanHandoff(row.payment)}
                            onClick={() => {
                              void handleExport(row.payment);
                            }}
                            title="Download full run summary (CSV, all workers)"
                            aria-label="Download worker payment summary CSV for this run"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {detailSelection && (
        <PaymentDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={(open) => {
            setIsDetailDialogOpen(open);
            if (!open) setDetailSelection(null);
          }}
          payment={detailSelection.payment}
          focusWorkerId={detailSelection.workerId}
          jobs={jobs}
        />
      )}
    </>
  );
}
