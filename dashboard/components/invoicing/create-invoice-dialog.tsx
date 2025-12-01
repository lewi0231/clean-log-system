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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useInvoices } from "@/hooks/use-invoices";
import { useJobs } from "@/hooks/use-jobs";
import useOrganization from "@/hooks/useOrganization";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const { organizationId } = useOrganization();
  const { jobs, loading: jobsLoading } = useJobs();
  const { calculateInvoice, createInvoice } = useInvoices();
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [calculating, setCalculating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [calculation, setCalculation] = useState<{
    total_subtotal: number;
    total_adjustments: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set default due date to 30 days from now
  useEffect(() => {
    if (open && !dueDate) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setDueDate(format(defaultDate, "yyyy-MM-dd"));
    }
  }, [open, dueDate]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedJobIds(new Set());
      setNotes("");
      setCalculation(null);
      setError(null);
    }
  }, [open]);

  // Calculate totals when selected jobs change
  useEffect(() => {
    if (selectedJobIds.size > 0 && organizationId) {
      const calculate = async () => {
        setCalculating(true);
        setError(null);
        try {
          const result = await calculateInvoice(Array.from(selectedJobIds));
          setCalculation({
            total_subtotal: result.total_subtotal,
            total_adjustments: result.total_adjustments,
            total: result.total,
          });
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to calculate totals"
          );
          setCalculation(null);
        } finally {
          setCalculating(false);
        }
      };

      const timeoutId = setTimeout(calculate, 500); // Debounce
      return () => clearTimeout(timeoutId);
    } else {
      setCalculation(null);
    }
  }, [selectedJobIds, organizationId, calculateInvoice]);

  const toggleJobSelection = (jobId: string) => {
    const newSelection = new Set(selectedJobIds);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else {
      newSelection.add(jobId);
    }
    setSelectedJobIds(newSelection);
  };

  const handleCreate = async () => {
    if (!organizationId || selectedJobIds.size === 0 || !dueDate) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createInvoice({
        organization_id: organizationId,
        job_ids: Array.from(selectedJobIds),
        due_date: new Date(dueDate).toISOString(),
        notes: notes || null,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  const completedJobs = jobs.filter((job) => job.completed_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Select completed jobs to include in this invoice. The system will
            automatically calculate totals based on your pricing configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Job Selection */}
          <div className="space-y-3">
            <Label>Select Jobs</Label>
            {jobsLoading ? (
              <LoadingState message="Loading jobs..." />
            ) : completedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed jobs available
              </p>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {completedJobs.map((job) => {
                  const isSelected = selectedJobIds.has(job.id);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => toggleJobSelection(job.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0"
                    >
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {new Date(job.completed_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.location?.name || "No location"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date *</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes for this invoice..."
              rows={3}
            />
          </div>

          {/* Calculation Preview */}
          {calculating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating totals...
            </div>
          )}

          {calculation && !calculating && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  ${calculation.total_subtotal.toFixed(2)}
                </span>
              </div>
              {calculation.total_adjustments !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adjustments:</span>
                  <span className="font-medium">
                    ${calculation.total_adjustments.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t">
                <span>Total:</span>
                <span>${calculation.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              creating ||
              selectedJobIds.size === 0 ||
              !dueDate ||
              calculating ||
              !calculation
            }
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
