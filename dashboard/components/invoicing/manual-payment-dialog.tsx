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
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePayments } from "@/hooks/use-payments";
import { log } from "@/lib/logger";
import { PaymentService } from "@/lib/services/payment.service";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "./payment-utils";

interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceTotal: number;
  totalPaid: number;
  currency: string;
  organizationId: string;
}

/**
 * Dialog for manually recording bank transfer or other offline payments
 * Follows Next.js best practices with proper validation and error handling
 */
export default function ManualPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceTotal,
  totalPaid,
  currency,
  organizationId,
}: ManualPaymentDialogProps) {
  const queryClient = useQueryClient();
  const { refetch: refetchPayments } = usePayments(invoiceId);

  const [amount, setAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingBalance = invoiceTotal - (totalPaid || 0);
  const suggestedAmount =
    remainingBalance > 0 ? remainingBalance : invoiceTotal;

  const resetForm = useCallback(() => {
    setAmount("");
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setError(null);
  }, []);

  // Track previous open state to detect transitions
  const prevOpenRef = useRef(open);

  // Reset form when dialog closes or when it opens after being closed (handles rerender case)
  useEffect(() => {
    // Reset when dialog closes
    if (!open && !submitting) {
      resetForm();
    }

    // Reset when dialog opens after being closed (handles rerender case where component remounts)
    if (open && !prevOpenRef.current && !submitting) {
      resetForm();
    }

    prevOpenRef.current = open;
  }, [open, submitting, resetForm]);

  const handleClose = (open: boolean) => {
    if (!open && !submitting) {
      resetForm();
    }
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation - check for empty string or whitespace
    const trimmedAmount = amount.trim();
    const amountNum = parseFloat(trimmedAmount);
    if (!trimmedAmount || isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (!paymentReference.trim()) {
      setError("Payment reference is required");
      return;
    }

    if (!paymentDate) {
      setError("Payment date is required");
      return;
    }

    try {
      setSubmitting(true);
      log.info("Creating manual payment", {
        invoiceId,
        amount: amountNum,
        reference: paymentReference,
      });

      await PaymentService.createManualPayment({
        invoice_id: invoiceId,
        organization_id: organizationId,
        amount: amountNum,
        currency,
        payment_reference: paymentReference.trim(),
        payment_date: paymentDate,
        notes: notes.trim() || undefined,
      });

      log.info("Manual payment created successfully");

      // Invalidate queries to refresh data
      await refetchPayments();
      queryClient.invalidateQueries({
        queryKey: ["invoice-details", invoiceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["invoices"],
      });

      // Close dialog and reset form
      resetForm();
      onOpenChange(false);
    } catch (err) {
      log.error("Failed to create manual payment", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Manual Payment</DialogTitle>
          <DialogDescription>
            Record a bank transfer or other offline payment for this invoice.
            The invoice status will be updated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount ({currency})
              <span className="text-xs text-muted-foreground ml-2">
                Remaining: {formatCurrency(remainingBalance, currency)}
              </span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={suggestedAmount.toFixed(2)}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Suggested: {formatCurrency(suggestedAmount, currency)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Payment Reference *</Label>
            <Input
              id="reference"
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g., Bank transfer reference, cheque number"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Transaction reference or identifier
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date *</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this payment"
              rows={3}
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="pt-2">
              <ErrorState message={error} />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
