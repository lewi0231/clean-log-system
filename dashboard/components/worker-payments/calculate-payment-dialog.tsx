"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import { Job } from "@/lib/types";
import { getCurrentPayPeriodRange } from "@/lib/worker-payments/org-pay-period";
import {
  buildWorkerPreviewRowsFromCalculation,
  formatDollarSharePercent,
  getWorkerJobPreviewLines,
  labelForSplitMode,
  type WorkerPreviewRow,
} from "@/lib/worker-payments/build-worker-preview";
import {
  formatDateForRangeInput,
  getDatePresetRange,
  isJobCompletedInLocalRange,
  type DatePreset,
} from "@/lib/worker-payments/date-presets";
import type {
  CalculateWorkerPaymentsResponse,
  WorkerPaymentCalculation,
} from "@/lib/services/worker-payment.service";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EqualSplitBadge } from "./equal-split-badge";

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function parseInputDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function JobWorkerSplitPreviewTable({
  calc,
  job,
  formatCurrency,
}: {
  calc: WorkerPaymentCalculation;
  job: Job | undefined;
  formatCurrency: (n: number) => string;
}) {
  if (!job) return null;
  const total = calc.total_worker_payment;
  const hasSplits = calc.worker_splits && calc.worker_splits.length > 0;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">Worker split</p>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="h-8">Worker</TableHead>
              <TableHead className="h-8 text-right">Amount</TableHead>
              <TableHead className="h-8 text-right">Share</TableHead>
              <TableHead className="h-8 text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasSplits
              ? calc.worker_splits!.map((s) => (
                  <TableRow key={s.worker_id} className="text-xs">
                    <TableCell className="py-1.5">
                      <div>{s.worker_name}</div>
                      {typeof s.time_share === "number" && s.time_share > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          Time weight{" "}
                          {(s.time_share <= 1 ? s.time_share * 100 : s.time_share).toFixed(0)}%
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-right font-mono">
                      {formatCurrency(s.final_payment)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">
                      {formatDollarSharePercent(s.final_payment, total)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      {Number.isFinite(s.hours_worked) ? s.hours_worked.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              : job.workers.map((w) => {
                  const n = job.workers.length;
                  const per = n > 0 ? total / n : 0;
                  return (
                    <TableRow key={w.id} className="text-xs">
                      <TableCell className="py-1.5">{w.name}</TableCell>
                      <TableCell className="py-1.5 text-right font-mono">
                        {formatCurrency(per)}
                      </TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">
                        {formatDollarSharePercent(per, total)}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">—</TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface CalculatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalculate: (jobIds: string[]) => Promise<void>;
  preselectedJobIds?: string[];
  jobs: Job[];
}

export default function CalculatePaymentDialog({
  open,
  onOpenChange,
  onCalculate,
  preselectedJobIds = [],
  jobs,
}: CalculatePaymentDialogProps) {
  const { calculatePayments, loading } = useWorkerPayments();
  const { formatCurrency } = useOrganizationCurrency();
  const { settings: orgSettings } = useOrganizationSettings();
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set(preselectedJobIds));
  const [preview, setPreview] = useState<CalculateWorkerPaymentsResponse | null>(null);
  const [lastPreviewedJobIds, setLastPreviewedJobIds] = useState<Set<string> | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [dateFromStr, setDateFromStr] = useState("");
  const [dateToStr, setDateToStr] = useState("");
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null);
  const [previewWorkerDetail, setPreviewWorkerDetail] = useState<WorkerPreviewRow | null>(null);

  React.useEffect(() => {
    if (preselectedJobIds.length > 0 && open) {
      setSelectedJobIds(new Set(preselectedJobIds));
    }
  }, [preselectedJobIds, open]);

  const jobsWithWorkers = useMemo(() => {
    return jobs.filter((job) => job.workers.length > 0);
  }, [jobs]);

  const dateFrom = parseInputDate(dateFromStr);
  const dateTo = parseInputDate(dateToStr);
  const dateRangeActive = Boolean(dateFrom && dateTo && dateFrom <= dateTo);

  const jobsInScope = useMemo(() => {
    if (!dateRangeActive || !dateFrom || !dateTo) {
      return jobsWithWorkers;
    }
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return jobsWithWorkers.filter((j) => isJobCompletedInLocalRange(j.completed_at, from, to));
  }, [jobsWithWorkers, dateRangeActive, dateFrom, dateTo]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setLastPreviewedJobIds(null);
  }, []);

  const setDateFromAndClear = (v: string) => {
    setDateFromStr(v);
    setActivePreset(null);
    clearPreview();
  };
  const setDateToAndClear = (v: string) => {
    setDateToStr(v);
    setActivePreset(null);
    clearPreview();
  };

  const applyPreset = (p: DatePreset) => {
    const cfg = orgSettings?.worker_payment_cycle_config ?? null;
    const want = p === "week" ? "weekly" : p === "fortnight" ? "fortnightly" : "monthly";
    let from: Date;
    let to: Date;
    let inputTz: string | null = null;
    if (cfg?.payment_frequency === want) {
      const r = getCurrentPayPeriodRange(cfg, {});
      from = r.from;
      to = r.to;
      inputTz = r.timeZone;
    } else {
      const r = getDatePresetRange(p, new Date(), cfg?.timezone);
      from = r.from;
      to = r.to;
      inputTz = cfg?.timezone && cfg.timezone.trim() ? cfg.timezone : null;
    }
    setDateFromStr(formatDateForRangeInput(from, inputTz));
    setDateToStr(formatDateForRangeInput(to, inputTz));
    setActivePreset(p);
    clearPreview();
  };

  const handleToggleJob = (jobId: string) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
    setPreview(null);
    setLastPreviewedJobIds(null);
  };

  const handleSelectAll = () => {
    const pool = jobsInScope;
    if (selectedJobIds.size === pool.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(pool.map((j) => j.id)));
    }
    clearPreview();
  };

  const handleSelectAllInRange = () => {
    if (!dateRangeActive) return;
    setSelectedJobIds(new Set(jobsInScope.map((j) => j.id)));
    clearPreview();
  };

  const handlePreview = async () => {
    if (selectedJobIds.size === 0) return;

    setCalculating(true);
    setError(null);
    try {
      const result = await calculatePayments(Array.from(selectedJobIds));
      if (result) {
        setPreview(result);
        setLastPreviewedJobIds(new Set(selectedJobIds));
        if (result.calculation.job_calculations.length > 0) {
          setExpandedJobs(new Set([result.calculation.job_calculations[0]!.job_id]));
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to calculate payments";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedJobIds.size === 0 || !preview) return;
    if (lastPreviewedJobIds && !setsEqual(selectedJobIds, lastPreviewedJobIds)) {
      toast.error("Run Preview again before saving—your job selection changed.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCalculate(Array.from(selectedJobIds));
      toast.success("Payment calculation saved successfully");
      onOpenChange(false);
      setSelectedJobIds(new Set());
      setPreview(null);
      setLastPreviewedJobIds(null);
      setExpandedJobs(new Set());
      setDateFromStr("");
      setDateToStr("");
      setActivePreset(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save payment";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedJobIds(new Set());
    setPreview(null);
    setError(null);
    setExpandedJobs(new Set());
    setDateFromStr("");
    setDateToStr("");
    setActivePreset(null);
    setLastPreviewedJobIds(null);
    setPreviewWorkerDetail(null);
  };

  const toggleJobExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const totalPreview = preview?.calculation.total_worker_payment || 0;

  const workerPreviewRows = useMemo(
    () => (preview ? buildWorkerPreviewRowsFromCalculation(preview, jobs) : []),
    [preview, jobs]
  );

  const selectionStaleForSave = Boolean(
    preview && lastPreviewedJobIds && !setsEqual(selectedJobIds, lastPreviewedJobIds)
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleClose();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>Calculate Worker Payments</DialogTitle>
                <DialogDescription>
                  Select jobs to calculate worker payments. Only jobs with assigned workers are
                  shown. Dates use your current timezone.
                </DialogDescription>
              </div>
              <ContextualHelp label="About saving and CSV handoff" className="shrink-0 -mt-1">
                <p>
                  <strong>Save</strong> creates a stored pay run with per-worker line items (one per
                  worker per job). Tally does <strong>not</strong> transfer money to workers.
                </p>
                <p>
                  After saving, use <strong>History</strong> to download a per-worker CSV for bank
                  or payroll entry.
                </p>
                <p className="text-xs">
                  Operator steps:{" "}
                  <code className="rounded bg-muted px-1">
                    docs/operator/worker-payments-handoff.md
                  </code>{" "}
                  in the repository.
                </p>
              </ContextualHelp>
            </div>
          </DialogHeader>

          {jobsWithWorkers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No jobs with workers assigned found.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pay-from">From (completion date)</Label>
                  <Input
                    id="pay-from"
                    type="date"
                    value={dateFromStr}
                    onChange={(e) => setDateFromAndClear(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pay-to">To (completion date)</Label>
                  <Input
                    id="pay-to"
                    type="date"
                    value={dateToStr}
                    onChange={(e) => setDateToAndClear(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "week" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => applyPreset("week")}
                >
                  This week
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "fortnight" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => applyPreset("fortnight")}
                >
                  This fortnight
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "month" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => applyPreset("month")}
                >
                  This month
                </Button>
              </div>
              {dateRangeActive && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer w-full sm:w-auto"
                  onClick={handleSelectAllInRange}
                >
                  Select all in range ({jobsInScope.length} jobs)
                </Button>
              )}

              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <Label>
                  {selectedJobIds.size} of {jobsInScope.length} jobs in list selected
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer w-fit"
                  onClick={handleSelectAll}
                >
                  {selectedJobIds.size === jobsInScope.length && jobsInScope.length > 0
                    ? "Deselect all in list"
                    : "Select all in list"}
                </Button>
              </div>
              {jobsInScope.length < jobsWithWorkers.length && (
                <p className="text-xs text-muted-foreground">
                  Showing {jobsInScope.length} of {jobsWithWorkers.length} jobs (date filter
                  active).
                </p>
              )}

              <div className="border rounded-md max-h-[400px] overflow-y-auto">
                {jobsInScope.map((job) => {
                  const isSelected = selectedJobIds.has(job.id);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => handleToggleJob(job.id)}
                      className="w-full flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0"
                    >
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {format(new Date(job.completed_at), "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.location?.name || "No location"} •{" "}
                          {job.workers.map((w) => w.name).join(", ") || "None"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 rounded-md text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {selectedJobIds.size > 0 && (
                <div className="space-y-4">
                  <Button
                    onClick={handlePreview}
                    disabled={calculating || loading}
                    variant="outline"
                    className="w-full cursor-pointer"
                  >
                    {calculating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      "Preview Calculation"
                    )}
                  </Button>

                  {selectionStaleForSave && (
                    <Alert
                      variant="default"
                      className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Preview out of date</AlertTitle>
                      <AlertDescription>
                        Job selection changed after your last preview. Run{" "}
                        <strong>Preview Calculation</strong> again before saving.
                      </AlertDescription>
                    </Alert>
                  )}

                  {preview && (
                    <div className="space-y-4">
                      {preview.calculation.job_calculations.some(
                        (jc) => (jc.calculation_warnings?.length ?? 0) > 0
                      ) && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Calculation notices</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1">
                              {preview.calculation.job_calculations.flatMap((jc) =>
                                (jc.calculation_warnings ?? []).map((w, idx) => (
                                  <li key={`${jc.job_id}-${idx}`}>{w}</li>
                                ))
                              )}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="border rounded-md p-4 space-y-3 bg-muted/50">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Worker Payment:</span>
                          <span className="text-xl font-bold text-primary">
                            {formatCurrency(totalPreview)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Jobs Included:</span>
                          <span>{preview.calculation.job_calculations.length}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Workers:</span>
                          <span>
                            {
                              new Set(
                                preview.calculation.job_calculations.flatMap((calc) => {
                                  const job = jobs.find((j) => j.id === calc.job_id);
                                  return (job?.workers ?? []).map((w) => w.id);
                                })
                              ).size
                            }
                          </span>
                        </div>
                      </div>

                      <Tabs defaultValue="by-worker" className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                          <TabsTrigger value="by-worker" className="cursor-pointer">
                            By worker
                          </TabsTrigger>
                          <TabsTrigger value="by-job" className="cursor-pointer">
                            By job
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="by-worker" className="mt-3 space-y-2">
                          <p className="md:hidden text-xs text-muted-foreground mb-1">
                            Swipe or expand for details. Totals are for this run only.
                          </p>
                          <div className="hidden md:block border rounded-md overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Worker</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="text-right">Share of run</TableHead>
                                  <TableHead>How split</TableHead>
                                  <TableHead className="text-right tabular-nums">
                                    Pool weight
                                  </TableHead>
                                  <TableHead className="text-right">Hours</TableHead>
                                  <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {workerPreviewRows.map((row) => (
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
                                    <TableCell className="text-right text-sm tabular-nums">
                                      {totalPreview > 0
                                        ? formatDollarSharePercent(row.total, totalPreview)
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="text-sm">
                                          {labelForSplitMode(row.splitMode)}
                                        </span>
                                        {row.splitMode === "equal_split_fallback" ? (
                                          <EqualSplitBadge />
                                        ) : null}
                                        {row.splitMode === "mixed" ? (
                                          <span className="text-xs text-muted-foreground">
                                            (time-based and equal-split jobs)
                                          </span>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                                      {row.weightLabel}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {row.hoursWorked > 0 ? row.hoursWorked.toFixed(1) : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="cursor-pointer h-8"
                                        onClick={() => setPreviewWorkerDetail(row)}
                                      >
                                        View lines
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="md:hidden space-y-2">
                            {workerPreviewRows.map((row) => (
                              <div
                                key={row.workerId}
                                className="border rounded-md p-3 space-y-2 bg-card"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <div className="font-medium">{row.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {row.workerId}
                                    </div>
                                  </div>
                                  <div className="text-lg font-semibold">
                                    {formatCurrency(row.total)}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Share of run:{" "}
                                  <span className="font-medium text-foreground tabular-nums">
                                    {totalPreview > 0
                                      ? formatDollarSharePercent(row.total, totalPreview)
                                      : "—"}
                                  </span>
                                </p>
                                <div className="flex flex-wrap items-center gap-1 text-sm">
                                  {labelForSplitMode(row.splitMode)}
                                  {row.splitMode === "equal_split_fallback" ? (
                                    <EqualSplitBadge />
                                  ) : null}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Pool weight:{" "}
                                  <span className="font-medium text-foreground tabular-nums">
                                    {row.weightLabel}
                                  </span>
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="w-full cursor-pointer"
                                  onClick={() => setPreviewWorkerDetail(row)}
                                >
                                  View lines
                                </Button>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="by-job" className="mt-3">
                          <div className="border rounded-md overflow-hidden">
                            <div className="bg-muted/50 px-4 py-2 border-b">
                              <h4 className="font-medium text-sm">Payment Breakdown by Job</h4>
                            </div>
                            <div className="max-h-[250px] overflow-y-auto">
                              {preview.calculation.job_calculations.map((calc) => {
                                const job = jobs.find((j) => j.id === calc.job_id);
                                const isExpanded = expandedJobs.has(calc.job_id);
                                const isEqualPath =
                                  !calc.worker_splits || calc.worker_splits.length === 0;
                                return (
                                  <div key={calc.job_id} className="border-b last:border-b-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleJobExpanded(calc.job_id)}
                                      className="w-full flex cursor-pointer items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium">
                                            {job?.location?.name || "Unknown Location"}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {job?.completed_at
                                              ? format(new Date(job.completed_at), "MMM d, yyyy")
                                              : "Unknown date"}{" "}
                                            • {(job?.workers ?? []).map((w) => w.name).join(", ")}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {isEqualPath && <EqualSplitBadge />}
                                        <Badge variant="secondary" className="font-mono">
                                          {formatCurrency(calc.total_worker_payment)}
                                        </Badge>
                                      </div>
                                    </button>

                                    {isExpanded && (
                                      <div className="px-4 pb-3 pl-9 space-y-3">
                                        <JobWorkerSplitPreviewTable
                                          calc={calc}
                                          job={job}
                                          formatCurrency={formatCurrency}
                                        />
                                        {calc.line_items.length > 0 && (
                                          <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                              Line items
                                            </p>
                                            <Table>
                                              <TableHeader>
                                                <TableRow className="text-xs">
                                                  <TableHead className="h-8">Item</TableHead>
                                                  <TableHead className="h-8 text-right">
                                                    Qty
                                                  </TableHead>
                                                  <TableHead className="h-8 text-right">
                                                    Unit Price
                                                  </TableHead>
                                                  <TableHead className="h-8 text-right">
                                                    Total
                                                  </TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {calc.line_items.map((item, idx) => (
                                                  <TableRow
                                                    key={`${item.field_config_id}-${idx}`}
                                                    className="text-xs"
                                                  >
                                                    <TableCell className="py-1.5">
                                                      {item.field_label}
                                                      {item.option_value && (
                                                        <span className="text-muted-foreground ml-1">
                                                          ({item.option_value})
                                                        </span>
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right">
                                                      {item.quantity}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right font-mono">
                                                      {formatCurrency(item.unit_price)}
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right font-mono">
                                                      {formatCurrency(item.total)}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <p className="text-xs text-muted-foreground sm:max-w-sm order-2 sm:order-1 text-left w-full sm:w-auto">
              Save runs only after a successful preview. Run preview again if you change which jobs
              are included.
            </p>
            <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="cursor-pointer"
                disabled={
                  selectedJobIds.size === 0 ||
                  calculating ||
                  loading ||
                  saving ||
                  !preview ||
                  selectionStaleForSave
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Payment"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewWorkerDetail}
        onOpenChange={(next) => {
          if (!next) setPreviewWorkerDetail(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewWorkerDetail ? `Lines for ${previewWorkerDetail.name}` : "Worker lines"}
            </DialogTitle>
            <DialogDescription>Amounts in this run (preview; not yet saved)</DialogDescription>
          </DialogHeader>
          {preview && previewWorkerDetail && (
            <div className="space-y-2">
              {getWorkerJobPreviewLines(preview, jobs, previewWorkerDetail.workerId).map((line) => {
                const job = jobs.find((j) => j.id === line.jobId);
                return (
                  <div
                    key={line.jobId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{job?.location?.name || line.jobId}</div>
                      <div className="text-xs text-muted-foreground">
                        {job?.completed_at
                          ? format(new Date(job.completed_at), "MMM d, yyyy")
                          : null}
                      </div>
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
