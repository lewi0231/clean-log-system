"use client";

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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import type { CalculateWorkerPaymentsResponse } from "@/lib/services/worker-payment.service";
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

interface CalculatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalculate: (jobIds: string[]) => Promise<void>;
  preselectedJobIds?: string[];
}

export default function CalculatePaymentDialog({
  open,
  onOpenChange,
  onCalculate,
  preselectedJobIds = [],
}: CalculatePaymentDialogProps) {
  const { jobs } = useJobs();
  const { calculatePayments, loading } = useWorkerPayments();
  const { formatCurrency } = useOrganizationCurrency();
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(
    new Set(preselectedJobIds)
  );
  const [preview, setPreview] =
    useState<CalculateWorkerPaymentsResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  // Update selected jobs when preselectedJobIds change
  React.useEffect(() => {
    if (preselectedJobIds.length > 0 && open) {
      setSelectedJobIds(new Set(preselectedJobIds));
    }
  }, [preselectedJobIds, open]);

  // Filter jobs that have workers assigned
  const jobsWithWorkers = useMemo(() => {
    return jobs.filter((job) => job.workers.length > 0);
  }, [jobs]);

  const handleToggleJob = (jobId: string) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
    setPreview(null);
  };

  const handleSelectAll = () => {
    if (selectedJobIds.size === jobsWithWorkers.length) {
      setSelectedJobIds(new Set());
      setPreview(null);
    } else {
      setSelectedJobIds(new Set(jobsWithWorkers.map((job) => job.id)));
    }
  };

  const handlePreview = async () => {
    if (selectedJobIds.size === 0) return;

    setCalculating(true);
    setError(null);
    try {
      const result = await calculatePayments(Array.from(selectedJobIds));
      if (result) {
        setPreview(result);
        // Expand first job by default if there are any
        if (result.calculation.job_calculations.length > 0) {
          setExpandedJobs(
            new Set([result.calculation.job_calculations[0].job_id])
          );
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to calculate payments";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedJobIds.size === 0 || !preview) return;

    setSaving(true);
    setError(null);
    try {
      await onCalculate(Array.from(selectedJobIds));
      toast.success("Payment calculation saved successfully");
      onOpenChange(false);
      setSelectedJobIds(new Set());
      setPreview(null);
      setExpandedJobs(new Set());
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save payment";
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calculate Worker Payments</DialogTitle>
          <DialogDescription>
            Select jobs to calculate worker payments. Only jobs with assigned
            workers are shown.
          </DialogDescription>
        </DialogHeader>

        {jobsWithWorkers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No jobs with workers assigned found.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>
                {selectedJobIds.size} of {jobsWithWorkers.length} jobs selected
              </Label>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedJobIds.size === jobsWithWorkers.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <div className="border rounded-md max-h-[400px] overflow-y-auto">
                {jobsWithWorkers.map((job) => {
                  const isSelected = selectedJobIds.has(job.id);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => handleToggleJob(job.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0"
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
                  className="w-full"
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

                {preview && (
                  <div className="space-y-4">
                    {/* Summary Card */}
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
                              preview.calculation.job_calculations.flatMap(
                                (calc) => {
                                  const job = jobs.find(
                                    (j) => j.id === calc.job_id
                                  );
                                  return (job?.workers ?? []).map((w) => w.id);
                                }
                              )
                            ).size
                          }
                        </span>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 border-b">
                        <h4 className="font-medium text-sm">
                          Payment Breakdown by Job
                        </h4>
                      </div>
                      <div className="max-h-[250px] overflow-y-auto">
                        {preview.calculation.job_calculations.map((calc) => {
                          const job = jobs.find((j) => j.id === calc.job_id);
                          const isExpanded = expandedJobs.has(calc.job_id);
                          return (
                            <div
                              key={calc.job_id}
                              className="border-b last:border-b-0"
                            >
                              <button
                                type="button"
                                onClick={() => toggleJobExpanded(calc.job_id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div>
                                    <div className="text-sm font-medium">
                                      {job?.location?.name || "Unknown Location"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {job?.completed_at
                                        ? format(
                                            new Date(job.completed_at),
                                            "MMM d, yyyy"
                                          )
                                        : "Unknown date"}{" "}
                                      •{" "}
                                      {(job?.workers ?? [])
                                        .map((w) => w.name)
                                        .join(", ")}
                                    </div>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="font-mono">
                                  {formatCurrency(calc.total_worker_payment)}
                                </Badge>
                              </button>

                              {isExpanded && calc.line_items.length > 0 && (
                                <div className="px-4 pb-3 pl-9">
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
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              selectedJobIds.size === 0 ||
              calculating ||
              loading ||
              saving ||
              !preview
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
