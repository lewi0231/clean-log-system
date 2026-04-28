"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { log } from "@/lib/logger";
import { getInvokeErrorMessage } from "@/lib/supabase/invoke-edge-function";
import { WorkerPaymentService, type PaymentRecord } from "@/lib/services/worker-payment.service";
import type { Job } from "@/lib/types";
import {
  downloadRemittancePdf,
  remittanceLineItemsFromWorkerRows,
} from "@/lib/worker-payments/remittance-pdf";
import { resolveWorkerEmail, isValidEmailFormat } from "@/lib/worker-payments/resolve-worker-email";
import { unpaidLinesForWorkerBatch } from "@/lib/worker-payments/unpaid-lines-for-worker-batch";
import { format } from "date-fns";
import { CheckCircle2, Download, Mail, AlertCircle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

interface MarkWorkerLinesPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One or more batches; unpaid lines for this worker are merged (e.g. several pay runs at once). */
  batches: PaymentRecord[];
  workerId: string;
  workerName: string;
  jobs: Job[];
  organizationId: string | null;
  onSuccess?: () => void;
}

type PaymentMethod = "bank_transfer" | "cash" | "check" | "payroll_system" | "other";

type DialogStep = "form" | "success";

export default function MarkWorkerLinesPaidDialog({
  open,
  onOpenChange,
  batches,
  workerId,
  workerName,
  jobs,
  organizationId,
  onSuccess,
}: MarkWorkerLinesPaidDialogProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const { settings } = useOrganizationSettings();
  const [step, setStep] = useState<DialogStep>("form");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const workerEmail = useMemo(() => {
    const resolved = resolveWorkerEmail(workerId, jobs);
    return resolved.email && isValidEmailFormat(resolved.email) ? resolved.email : null;
  }, [workerId, jobs]);

  const allPaymentsFlat = useMemo(() => batches.flatMap((b) => b.payments ?? []), [batches]);

  const unpaidLines = useMemo(
    () => batches.flatMap((b) => unpaidLinesForWorkerBatch(b.payments, workerId)),
    [batches, workerId]
  );

  /** Open with all unpaid jobs selected; one "Mark as paid" submits the batch selection. */
  useEffect(() => {
    if (!open) return;
    setStep("form");
    setMarkedIds(new Set());
    setEmailSent(false);
    setEmailError(null);
    const lines = batches.flatMap((b) => unpaidLinesForWorkerBatch(b.payments, workerId));
    setSelectedIds(new Set(lines.map((l) => l.id)));
  }, [open, batches, workerId]);

  /** Single currency for merged runs (same org). */
  const payoutCurrency = batches[0]?.currency ?? "AUD";

  const jobNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      const label = job.location?.name ?? `Job ${job.id.slice(0, 8)}`;
      map.set(job.id, label);
    }
    return map;
  }, [jobs]);

  const selectedTotal = useMemo(() => {
    return unpaidLines
      .filter((line) => selectedIds.has(line.id))
      .reduce((sum, line) => sum + line.amount, 0);
  }, [unpaidLines, selectedIds]);

  const toggleLine = (lineId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === unpaidLines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidLines.map((l) => l.id)));
    }
  };

  const resetForm = () => {
    setStep("form");
    setSelectedIds(new Set());
    setMarkedIds(new Set());
    setPaymentMethod("");
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setEmailSent(false);
    setEmailError(null);
  };

  const periodLabel = useMemo(() => {
    if (batches.length === 0) return "Pay run";
    if (batches.length === 1) {
      const b = batches[0]!;
      const start = b.dateRange?.start;
      const end = b.dateRange?.end;
      if (!start || !end) return "Pay run";
      try {
        return `${format(new Date(start), "MMM d")} – ${format(new Date(end), "MMM d, yyyy")}`;
      } catch {
        return "Pay run";
      }
    }
    const starts = batches.map((b) => new Date(b.dateRange?.start ?? 0).getTime());
    const ends = batches.map((b) => new Date(b.dateRange?.end ?? 0).getTime());
    const lo = Math.min(...starts);
    const hi = Math.max(...ends);
    try {
      return `${batches.length} pay runs (${format(new Date(lo), "MMM d, yyyy")} – ${format(new Date(hi), "MMM d, yyyy")})`;
    } catch {
      return `${batches.length} pay runs`;
    }
  }, [batches]);

  const handleDownloadRemittance = async () => {
    if (markedIds.size === 0) return;

    setDownloading(true);
    try {
      const markedRows = allPaymentsFlat.filter((l) => markedIds.has(l.id));
      const lines = remittanceLineItemsFromWorkerRows(
        markedRows,
        (jobId) => jobNameMap.get(jobId) ?? `Job ${jobId.slice(0, 8)}`
      ).map((l) => ({
        ...l,
        paidAt: l.paidAt ?? paymentDate ?? null,
      }));

      await downloadRemittancePdf({
        organizationName: settings?.name ?? "Organization",
        workerName,
        periodLabel,
        generatedAt: new Date(),
        currency: payoutCurrency,
        lines,
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
        paymentDate: paymentDate || null,
      });

      toast.success("Remittance PDF downloaded");
    } catch (err) {
      log.error("Failed to generate remittance PDF", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!organizationId || !workerEmail || markedIds.size === 0) return;

    setSendingEmail(true);
    setEmailError(null);

    try {
      const markedRows = allPaymentsFlat.filter((l) => markedIds.has(l.id));
      const lineItems = remittanceLineItemsFromWorkerRows(
        markedRows,
        (jobId) => jobNameMap.get(jobId) ?? `Job ${jobId.slice(0, 8)}`
      ).map((l) => ({
        jobName: l.jobName,
        amount: l.amount,
        paidAt: l.paidAt ?? paymentDate ?? null,
        paymentReference: l.paymentReference,
        poolWeight: l.poolWeight ?? null,
        hoursWorked: l.hoursWorked ?? null,
      }));

      const result = await WorkerPaymentService.sendRemittanceEmail(organizationId, {
        workerEmail,
        workerName,
        periodLabel,
        currency: payoutCurrency,
        lines: lineItems,
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
        paymentDate: paymentDate || null,
        totalAmount: markedTotal,
      });

      if (result.ok) {
        setEmailSent(true);
        toast.success("Remittance email sent");
      } else {
        if (result.code === "EMAIL_NOT_CONFIGURED") {
          setEmailError("Email service is not configured. Contact your administrator.");
        } else {
          setEmailError(result.message ?? "Failed to send email");
        }
        log.warn("Failed to send remittance email", {
          code: result.code,
          message: result.message,
        });
        toast.error(result.message ?? "Failed to send email");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setEmailError(msg);
      log.error("Failed to send remittance email", { error: msg });
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error("Organization ID is required");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    if (selectedIds.size === 0) {
      toast.error("Please select at least one job to mark as paid");
      return;
    }

    setLoading(true);
    const idsToMark = Array.from(selectedIds);
    let successCount = 0;
    let failedCount = 0;

    const successfulIds: string[] = [];
    let showedFailureToast = false;
    try {
      for (const paymentId of idsToMark) {
        try {
          await WorkerPaymentService.updatePaymentStatus(organizationId, {
            paymentId,
            status: "paid",
            paymentMethod: paymentMethod as PaymentMethod,
            paymentReference: paymentReference || undefined,
            paymentDate: paymentDate || undefined,
            notes: notes || undefined,
          });
          successCount++;
          successfulIds.push(paymentId);
        } catch (err) {
          failedCount++;
          showedFailureToast = true;
          const message = getInvokeErrorMessage(err);
          log.error("WorkerPayments: Failed to mark line as paid", {
            errorMessage: message,
            paymentId,
            organizationId,
          });
          toast.error(message);
          break;
        }
      }

      if (successCount > 0) {
        setMarkedIds(new Set(successfulIds));
        setStep("success");
        onSuccess?.();

        if (failedCount > 0) {
          toast.warning(
            `${successCount} of ${idsToMark.length} payments updated. Some could not be marked.`
          );
        }
      } else if (!showedFailureToast) {
        toast.error("Failed to mark payments as paid");
      }
    } finally {
      setLoading(false);
    }
  };

  const markedTotal = useMemo(() => {
    return unpaidLines
      .filter((line) => markedIds.has(line.id))
      .reduce((sum, line) => sum + line.amount, 0);
  }, [unpaidLines, markedIds]);

  if (step === "success") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Payment recorded
            </DialogTitle>
            <DialogDescription>
              {markedIds.size} job{markedIds.size === 1 ? "" : "s"} marked as paid for {workerName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total paid</span>
                <span className="font-mono font-medium">{formatCurrency(markedTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Period</span>
                <span>{periodLabel}</span>
              </div>
              {paymentReference && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono">{paymentReference}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={handleDownloadRemittance}
                disabled={downloading}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloading ? "Generating..." : "Download PDF"}
              </Button>

              {workerEmail ? (
                <Button
                  type="button"
                  variant={emailSent ? "secondary" : "outline"}
                  className="flex-1 cursor-pointer"
                  onClick={handleSendEmail}
                  disabled={sendingEmail || emailSent}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {emailSent ? "Email sent" : sendingEmail ? "Sending..." : "Email to worker"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 cursor-not-allowed opacity-50"
                  disabled
                  title="No email address found for this worker"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  No email
                </Button>
              )}
            </div>

            {emailError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{emailError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" className="cursor-pointer" onClick={handleClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mark jobs as paid</DialogTitle>
            <DialogDescription>
              Choose which jobs to include (all are selected by default). Use one{" "}
              <strong>Mark as paid</strong> below to record a single payment for the selected jobs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {unpaidLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unpaid jobs found for this worker across the selected pay run
                {batches.length > 1 ? "s" : ""}.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Jobs to pay</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={toggleAll}
                      className="h-auto py-1 text-xs cursor-pointer"
                    >
                      {selectedIds.size === unpaidLines.length ? "Deselect all" : "Select all"}
                    </Button>
                  </div>
                  <div className="rounded-md border max-h-48 overflow-y-auto">
                    <ul className="divide-y">
                      {unpaidLines.map((line) => {
                        const jobName =
                          jobNameMap.get(line.job_id) ?? `Job ${line.job_id.slice(0, 8)}`;
                        return (
                          <li key={line.id} className="flex items-center gap-3 px-3 py-2">
                            <Checkbox
                              id={`line-${line.id}`}
                              checked={selectedIds.has(line.id)}
                              onCheckedChange={() => toggleLine(line.id)}
                              className="cursor-pointer"
                            />
                            <label
                              htmlFor={`line-${line.id}`}
                              className="flex-1 text-sm cursor-pointer select-none"
                            >
                              {jobName}
                            </label>
                            <span className="font-mono text-sm tabular-nums text-muted-foreground">
                              {formatCurrency(line.amount)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {selectedIds.size > 0 && (
                    <p className="text-sm font-medium text-right">
                      Selected: {formatCurrency(selectedTotal)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-method">
                    Payment Method <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                    required
                  >
                    <SelectTrigger id="payment-method" className="cursor-pointer">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="payroll_system">Payroll System</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-date">
                    Payment Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-reference">Payment Reference</Label>
                  <Input
                    id="payment-reference"
                    placeholder="e.g., Transaction ID, Check #, etc."
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional: Reference number for tracking this payment
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes about this payment..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedIds.size === 0 || !paymentMethod}
              className="cursor-pointer"
            >
              {loading ? "Saving..." : selectedIds.size === 0 ? "Select jobs" : "Mark as paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
