"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
import { log } from "@/lib/logger";
import { Job } from "@/lib/types";
import {
  hoursFromCalculationDetails,
  poolWeightFromCalculationDetails,
  rollupByWorkerId,
  splitModeFromRow,
} from "@/lib/worker-payments/export-batch-worker-csv";
import { labelForSplitMode } from "@/lib/worker-payments/build-worker-preview";
import {
  downloadRemittancePdf,
  remittanceLineItemsFromWorkerRows,
} from "@/lib/worker-payments/remittance-pdf";
import { getWorkerSettlementStatus } from "@/lib/worker-payments/payment-settlement-status";
import Link from "next/link";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EqualSplitBadge } from "./equal-split-badge";
import { Badge } from "@/components/ui/badge";

interface PaymentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRecord;
  jobs: Job[];
  /** When set, the dialog is scoped to this worker (history / remittance). */
  focusWorkerId?: string | null;
}

type SavedWorkerLine = {
  id: string;
  jobId: string;
  amount: number;
  mode: string;
  poolWeight: number | null;
  hours: number | null;
  status: string;
  paidAt: string | null;
};

function settlementBadgeLabel(s: ReturnType<typeof getWorkerSettlementStatus>): {
  label: string;
  variant: "default" | "secondary" | "outline";
} {
  if (s === "complete") return { label: "Recorded paid", variant: "default" };
  if (s === "partial") return { label: "Partially paid", variant: "secondary" };
  return { label: "Not paid", variant: "outline" };
}

export default function PaymentDetailDialog({
  open,
  onOpenChange,
  payment,
  jobs,
  focusWorkerId: focusWorkerIdProp = null,
}: PaymentDetailDialogProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { settings } = useOrganizationSettings();
  const [detailWorkerId, setDetailWorkerId] = useState<string | null>(null);
  const [downloadingWorkerId, setDownloadingWorkerId] = useState<string | null>(null);

  const jobCalculations = payment.calculation.calculation.job_calculations;
  const payments = payment.payments;
  const currency = payment.currency ?? "AUD";
  const focusWorkerId = focusWorkerIdProp;

  const periodLabel = useMemo(() => {
    const start = payment.dateRange?.start;
    const end = payment.dateRange?.end;
    if (!start || !end) return "Pay run";
    try {
      return `${format(new Date(start), "MMM d")} – ${format(new Date(end), "MMM d, yyyy")}`;
    } catch {
      return "Pay run";
    }
  }, [payment.dateRange]);

  const paidLinesForWorker = (workerId: string) => {
    if (!payments?.length) return [];
    return payments.filter((p) => p.worker_id === workerId && p.status === "paid");
  };

  const handleDownloadRemittance = async (workerId: string, workerName: string) => {
    const paidLines = paidLinesForWorker(workerId);
    if (paidLines.length === 0) {
      toast.error("No paid lines for this worker");
      return;
    }

    setDownloadingWorkerId(workerId);
    try {
      const lines = remittanceLineItemsFromWorkerRows(paidLines, (jobId) => {
        const j = jobs.find((x) => x.id === jobId);
        return j?.location?.name ?? `Job ${jobId.slice(0, 8)}`;
      });

      await downloadRemittancePdf({
        organizationName: settings?.name ?? "Organization",
        workerName,
        periodLabel,
        generatedAt: new Date(),
        currency,
        lines,
        paymentMethod: paidLines[0]?.payment_method ?? null,
        paymentReference: paidLines[0]?.payment_reference ?? null,
        paymentDate: paidLines[0]?.paid_at ?? null,
      });

      toast.success("Remittance PDF downloaded");
    } catch (err) {
      log.error("Failed to generate remittance PDF", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingWorkerId(null);
    }
  };

  const rollup = useMemo(() => {
    if (!payments?.length) return new Map();
    return rollupByWorkerId(payments);
  }, [payments]);

  const perWorkerFromSaved = useMemo(() => {
    if (!payments?.length) return [];
    const out: {
      workerId: string;
      name: string;
      total: number;
      hours: number;
      mode: string;
    }[] = [];
    for (const [workerId, entry] of rollup) {
      out.push({
        workerId,
        name: WorkerPaymentService.resolveWorkerNameForExport(payment, workerId, jobs),
        total: entry.total,
        hours: entry.hoursWorked,
        mode: entry.splitMode,
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return out;
  }, [rollup, payment, jobs, payments]);

  const savedLinesForWorker = (workerId: string): SavedWorkerLine[] => {
    if (!payments?.length) return [];
    return payments
      .filter((p) => p.worker_id === workerId)
      .map((p) => ({
        id: p.id,
        jobId: p.job_id,
        amount: p.amount,
        mode: splitModeFromRow(p.calculation_details),
        poolWeight: poolWeightFromCalculationDetails(p.calculation_details),
        hours: hoursFromCalculationDetails(p.calculation_details),
        status: p.status,
        paidAt: p.paid_at,
      }));
  };

  const focusName = focusWorkerId
    ? WorkerPaymentService.resolveWorkerNameForExport(payment, focusWorkerId, jobs)
    : null;

  const focusLines: SavedWorkerLine[] = useMemo(() => {
    if (!focusWorkerId || !payments?.length) return [];
    return payments
      .filter((p) => p.worker_id === focusWorkerId)
      .map((p) => ({
        id: p.id,
        jobId: p.job_id,
        amount: p.amount,
        mode: splitModeFromRow(p.calculation_details),
        poolWeight: poolWeightFromCalculationDetails(p.calculation_details),
        hours: hoursFromCalculationDetails(p.calculation_details),
        status: p.status,
        paidAt: p.paid_at,
      }));
  }, [focusWorkerId, payments]);
  const focusTotal = focusLines.reduce((s, l) => s + l.amount, 0);
  const focusSettlement = focusWorkerId ? getWorkerSettlementStatus(payments, focusWorkerId) : null;

  const jobIdsForFocus = useMemo(() => new Set(focusLines.map((l) => l.jobId)), [focusLines]);

  const jobCalculationsFiltered = useMemo(
    () => jobCalculations.filter((c) => jobIdsForFocus.has(c.job_id)),
    [jobCalculations, jobIdsForFocus]
  );

  if (open && focusWorkerId && focusName) {
    const spec = focusSettlement
      ? settlementBadgeLabel(focusSettlement)
      : { label: "—", variant: "outline" as const };
    const hasPaidLines = paidLinesForWorker(focusWorkerId).length > 0;

    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Worker payment — {focusName}</DialogTitle>
              <DialogDescription>
                Pay run {format(new Date(payment.dateRange.start), "MMM d, yyyy")} –{" "}
                {format(new Date(payment.dateRange.end), "MMM d, yyyy")} · Run total{" "}
                {formatCurrency(payment.totalPayment)} ({payment.jobIds.length} jobs,{" "}
                {payment.workerCount} workers)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This worker in run</p>
                  <p className="text-2xl font-bold">{formatCurrency(focusTotal)}</p>
                </div>
                {focusSettlement && <Badge variant={spec.variant}>{spec.label}</Badge>}
              </div>

              {hasPaidLines && (
                <Button
                  type="button"
                  className="cursor-pointer w-full sm:w-auto"
                  variant="default"
                  onClick={() => handleDownloadRemittance(focusWorkerId, focusName)}
                  disabled={downloadingWorkerId === focusWorkerId}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadingWorkerId === focusWorkerId ? "…" : "Download remittance PDF"}
                </Button>
              )}

              {focusLines.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Wt</TableHead>
                        <TableHead className="text-right">Hrs</TableHead>
                        <TableHead>Split</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {focusLines.map((line) => {
                        const job = jobs.find((j) => j.id === line.jobId);
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div className="font-medium">{job?.location?.name ?? line.jobId}</div>
                              <Link
                                href={`/dashboard/completed-jobs?job=${line.jobId}`}
                                className="text-xs text-primary underline"
                              >
                                Open in Completed jobs
                              </Link>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(line.amount)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {line.poolWeight != null
                                ? Number.isInteger(line.poolWeight)
                                  ? String(line.poolWeight)
                                  : line.poolWeight.toFixed(1)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {line.hours != null ? line.hours.toFixed(1) : "—"}
                            </TableCell>
                            <TableCell>
                              {labelForSplitMode(line.mode)}
                              {line.mode === "equal_split_fallback" && <EqualSplitBadge />}
                            </TableCell>
                            <TableCell className="text-sm capitalize">{line.status}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <details className="group border rounded-md p-3 text-sm">
                <summary className="cursor-pointer font-medium">Full pay run (all workers)</summary>
                <div className="mt-3 pt-2 border-t space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Totals for everyone in this calculated run.
                  </p>
                  {perWorkerFromSaved.length > 0 && (
                    <div className="border rounded-md overflow-hidden text-sm">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Worker</TableHead>
                            <TableHead className="text-right">In run</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {perWorkerFromSaved.map((r) => (
                            <TableRow key={r.workerId}>
                              <TableCell>
                                {r.name}
                                {r.workerId === focusWorkerId ? (
                                  <span className="text-xs text-primary ml-1">(this row)</span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(r.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </details>

              <details className="group border rounded-md p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Pricing detail for this worker (jobs in this run)
                </summary>
                <div className="mt-3 space-y-4 pt-2 border-t max-h-[50vh] overflow-y-auto pr-1">
                  {jobCalculationsFiltered.map((calc) => {
                    const job = jobs.find((j) => j.id === calc.job_id);
                    if (!job) return null;
                    const splits = (calc.worker_splits ?? []).filter(
                      (s) => s.worker_id === focusWorkerId
                    );
                    const isEqualPath = !calc.worker_splits || calc.worker_splits.length === 0;
                    return (
                      <div key={calc.job_id} className="border rounded-lg p-3 space-y-2">
                        <div className="font-medium text-sm">
                          {job.location?.name ?? calc.job_id}
                        </div>
                        {isEqualPath && (
                          <div className="text-xs text-muted-foreground">
                            Equal pool among workers on this job.
                          </div>
                        )}
                        {splits.length > 0 && (
                          <div className="text-sm space-y-1">
                            {splits.map((s) => (
                              <div key={s.worker_id} className="flex justify-between gap-2">
                                <span>Share (time-based)</span>
                                <span className="font-mono">{formatCurrency(s.final_payment)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>Detailed breakdown of worker payment calculation</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Date Range</div>
                <div className="font-medium">
                  {format(new Date(payment.dateRange.start), "MMM d, yyyy")} -{" "}
                  {format(new Date(payment.dateRange.end), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Payment</div>
                <div className="text-2xl font-bold">{formatCurrency(payment.totalPayment)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Jobs</div>
                <div className="font-medium">{payment.jobIds.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Workers</div>
                <div className="font-medium">{payment.workerCount}</div>
              </div>
            </div>

            <Separator />

            {payments && payments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">By worker (saved run)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Amounts match the worker summary CSV. Currency: {currency}
                </p>
                <div className="hidden md:block border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead className="text-right">Total (batch)</TableHead>
                        <TableHead>Split</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="w-[180px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perWorkerFromSaved.map((row) => {
                        const hasPaidLines = paidLinesForWorker(row.workerId).length > 0;
                        return (
                          <TableRow key={row.workerId}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {row.workerId}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row.total)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {labelForSplitMode(row.mode)}
                                {row.mode === "equal_split_fallback" && <EqualSplitBadge />}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {row.hours > 0 ? row.hours.toFixed(1) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {hasPaidLines && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="cursor-pointer h-8"
                                    onClick={() => handleDownloadRemittance(row.workerId, row.name)}
                                    disabled={downloadingWorkerId === row.workerId}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    {downloadingWorkerId === row.workerId ? "..." : "PDF"}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="cursor-pointer h-8"
                                  onClick={() => setDetailWorkerId(row.workerId)}
                                >
                                  Details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-2">
                  {perWorkerFromSaved.map((row) => {
                    const hasPaidLines = paidLinesForWorker(row.workerId).length > 0;
                    return (
                      <div key={row.workerId} className="border rounded-md p-3 space-y-2">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {row.workerId}
                            </div>
                          </div>
                          <div className="text-lg font-semibold">{formatCurrency(row.total)}</div>
                        </div>
                        <div className="flex flex-wrap gap-1 text-sm">
                          {labelForSplitMode(row.mode)}
                          {row.mode === "equal_split_fallback" && <EqualSplitBadge />}
                        </div>
                        <div className="flex gap-2">
                          {hasPaidLines && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 cursor-pointer"
                              onClick={() => handleDownloadRemittance(row.workerId, row.name)}
                              disabled={downloadingWorkerId === row.workerId}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              {downloadingWorkerId === row.workerId ? "..." : "Remittance"}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 cursor-pointer"
                            onClick={() => setDetailWorkerId(row.workerId)}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(!payments || payments.length === 0) && (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 rounded-md p-3">
                Per-worker lines are not loaded for this batch. Close and open again, or export from
                History when available.
              </p>
            )}

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-4">Job Breakdown (calculation)</h3>
              <div className="space-y-6">
                {jobCalculations.map((calc) => {
                  const job = jobs.find((j) => j.id === calc.job_id);
                  if (!job) return null;
                  const isEqualPath = !calc.worker_splits || calc.worker_splits.length === 0;
                  return (
                    <div key={calc.job_id} className="border rounded-lg p-4">
                      <div className="mb-4">
                        <div className="font-semibold">
                          Job - {format(new Date(job.completed_at), "MMM d, yyyy")}
                          {job.location?.name && ` - ${job.location.name}`}
                        </div>
                        {isEqualPath && (
                          <div className="mt-1">
                            <EqualSplitBadge />
                          </div>
                        )}
                        {job.workers && job.workers.length > 0 && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Workers: {job.workers.map((w) => w.name).join(", ")}
                          </div>
                        )}
                      </div>

                      {calc.line_items.length > 0 && (
                        <div className="mb-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Field</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {calc.line_items.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    {item.field_label}
                                    {item.option_value && (
                                      <span className="text-muted-foreground ml-2">
                                        ({item.option_value})
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.unit_price)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(item.total)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="space-y-2 border-t pt-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(calc.subtotal)}</span>
                        </div>
                        {calc.total_adjustments !== 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Adjustments:</span>
                            <span className="font-medium">
                              {formatCurrency(calc.total_adjustments)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-semibold pt-2 border-t">
                          <span>Total Payment:</span>
                          <span>{formatCurrency(calc.total_worker_payment)}</span>
                        </div>
                      </div>

                      {calc.applied_rules.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="text-sm font-medium mb-2">Applied Pricing Rules:</div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {calc.applied_rules.map((rule, idx) => (
                              <div key={idx}>
                                {rule.pricing_type} - {formatCurrency(rule.amount)}
                                {rule.scope !== "global" && (
                                  <span className="ml-2">({rule.scope} scope)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailWorkerId} onOpenChange={() => setDetailWorkerId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailWorkerId
                ? `Details — ${WorkerPaymentService.resolveWorkerNameForExport(
                    payment,
                    detailWorkerId,
                    jobs
                  )}`
                : "Details"}
            </DialogTitle>
            <DialogDescription>Per job amounts from saved worker_payment rows</DialogDescription>
          </DialogHeader>
          {detailWorkerId && (
            <div className="space-y-2">
              {savedLinesForWorker(detailWorkerId).map((line) => {
                const job = jobs.find((j) => j.id === line.jobId);
                return (
                  <div
                    key={line.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{job?.location?.name || line.jobId}</div>
                      <div className="text-xs text-muted-foreground">
                        {labelForSplitMode(line.mode)}
                      </div>
                    </div>
                    <div className="font-mono font-medium">{formatCurrency(line.amount)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
