"use client";

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
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import type { CalculateWorkerPaymentsResponse } from "@/lib/services/worker-payment.service";
import { format } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import React, { useMemo, useState } from "react";

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
    try {
      const result = await calculatePayments(Array.from(selectedJobIds));
      if (result) {
        setPreview(result);
      }
    } catch (error) {
      console.error("Failed to preview payments:", error);
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedJobIds.size === 0) return;

    await onCalculate(Array.from(selectedJobIds));
    onOpenChange(false);
    setSelectedJobIds(new Set());
    setPreview(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedJobIds(new Set());
    setPreview(null);
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

            {selectedJobIds.size > 0 && (
              <div className="space-y-2">
                <Button
                  onClick={handlePreview}
                  disabled={calculating || loading}
                  variant="outline"
                  className="w-full"
                >
                  {calculating ? "Calculating..." : "Preview Calculation"}
                </Button>

                {preview && (
                  <div className="border rounded-md p-4 space-y-2 bg-muted/50">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Payment:</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(totalPreview)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Jobs:</span>
                      <span>{preview.calculation.job_calculations.length}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              selectedJobIds.size === 0 || calculating || loading || !preview
            }
          >
            {calculating ? "Saving..." : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
