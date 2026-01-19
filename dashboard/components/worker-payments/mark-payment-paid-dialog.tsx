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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import useOrganization from "@/hooks/useOrganization";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { useState } from "react";
import { toast } from "sonner";

interface MarkPaymentPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  onSuccess?: () => void;
}

export default function MarkPaymentPaidDialog({
  open,
  onOpenChange,
  batchId,
  onSuccess,
}: MarkPaymentPaidDialogProps) {
  const { organizationId } = useOrganization();
  const [paymentMethod, setPaymentMethod] = useState<
    "bank_transfer" | "cash" | "check" | "payroll_system" | "other" | ""
  >("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      await WorkerPaymentService.updatePaymentStatus(organizationId, {
        batchId,
        status: "paid",
        paymentMethod,
        paymentReference: paymentReference || undefined,
        paymentDate: paymentDate || undefined,
        notes: notes || undefined,
      });

      toast.success("Payment marked as paid successfully");
      onOpenChange(false);
      // Reset form
      setPaymentMethod("");
      setPaymentReference("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to mark payment as paid:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to mark payment as paid"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mark Payment as Paid</DialogTitle>
            <DialogDescription>
              Record payment details after processing payments externally (bank
              transfer, cash, check, etc.).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">
                Payment Method <span className="text-destructive">*</span>
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(
                    value as
                      | "bank_transfer"
                      | "cash"
                      | "check"
                      | "payroll_system"
                      | "other"
                  )
                }
                required
              >
                <SelectTrigger id="payment-method">
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
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
