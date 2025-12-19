"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInvoices } from "@/hooks/use-invoices";
import { log } from "@/lib/logger";
import { InvoiceService } from "@/lib/services/invoice.service";
import type { InvoiceWithJobs } from "@/lib/types";
import { format } from "date-fns";
import { CheckCircle2, FileText, Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface InvoiceListProps {
  onInvoiceClick?: (invoice: InvoiceWithJobs) => void;
}

export default function InvoiceList({ onInvoiceClick }: InvoiceListProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const { invoices, loading, error, refetch } = useInvoices(
    startDate || undefined,
    endDate || undefined
  );
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [invoiceToResend, setInvoiceToResend] =
    useState<InvoiceWithJobs | null>(null);

  const getStatusBadge = (invoice: InvoiceWithJobs) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      draft: "outline",
      sent: "default",
      paid: "secondary",
      overdue: "destructive",
      cancelled: "outline",
    };

    const status = invoice.status;
    const isPaid = invoice.paid_at !== null;

    return (
      <div className="flex items-center gap-2">
        <Badge variant={variants[status] || "default"}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
        {isPaid && (
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Paid" />
        )}
      </div>
    );
  };

  const getLocationNames = (invoice: InvoiceWithJobs): string => {
    const locations = new Set<string>();
    invoice.invoice_job?.forEach((ij) => {
      if (ij.job?.location?.name) {
        locations.add(ij.job.location.name);
      }
    });
    return Array.from(locations).join(", ") || "-";
  };

  const getJobCount = (invoice: InvoiceWithJobs): number => {
    return invoice.invoice_job?.length || 0;
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const hasFilters = startDate || endDate;

  const handleSendInvoice = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation(); // Prevent row click
    try {
      setSendingInvoiceId(invoiceId);
      log.info("Sending invoice", { invoiceId });

      await InvoiceService.updateStatus(invoiceId, "sent");

      // Refetch invoices to get updated status
      await refetch();

      log.info("Invoice sent successfully");
      toast.success("Invoice sent successfully", {
        description: "The invoice has been emailed to the customer.",
      });
    } catch (err) {
      log.error("Failed to send invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to send invoice", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const openResendDialog = (e: React.MouseEvent, invoice: InvoiceWithJobs) => {
    e.stopPropagation(); // Prevent row click
    setInvoiceToResend(invoice);
    setResendDialogOpen(true);
  };

  const handleResendConfirmed = async () => {
    if (!invoiceToResend) return;

    setResendDialogOpen(false);

    try {
      setSendingInvoiceId(invoiceToResend.id);
      log.info("Resending invoice", { invoiceId: invoiceToResend.id });

      await InvoiceService.resendInvoice(invoiceToResend.id);

      // Refetch invoices to get updated status
      await refetch();

      log.info("Invoice resent successfully");
      toast.success("Invoice resent successfully", {
        description: "A new payment link has been generated and emailed.",
      });
    } catch (err) {
      log.error("Failed to resend invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to resend invoice", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSendingInvoiceId(null);
      setInvoiceToResend(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Date filter skeletons */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <TableSkeleton rows={5} columns={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error: {error}</div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Date Range Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="start-date" className="text-sm">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Filter by start date"
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="end-date" className="text-sm">
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Filter by end date"
            />
          </div>
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        {/* Invoice Table */}
        {invoices.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No invoices found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {hasFilters
                ? "Try adjusting your date range filters"
                : "Create your first invoice from a completed job"}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className={
                      onInvoiceClick ? "cursor-pointer hover:bg-muted/50" : ""
                    }
                    onClick={() => onInvoiceClick?.(invoice)}
                  >
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{getJobCount(invoice)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {getLocationNames(invoice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${invoice.total.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice)}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.due_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {invoice.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleSendInvoice(e, invoice.id)}
                            disabled={sendingInvoiceId === invoice.id}
                          >
                            <Mail className="mr-1 h-3 w-3" />
                            {sendingInvoiceId === invoice.id
                              ? "Sending..."
                              : "Send"}
                          </Button>
                        )}
                        {invoice.status === "sent" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => openResendDialog(e, invoice)}
                            disabled={sendingInvoiceId === invoice.id}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            {sendingInvoiceId === invoice.id
                              ? "Resending..."
                              : "Resend"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Resend Confirmation Dialog */}
      <AlertDialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new payment link and send the invoice again
              to the customer. The previous payment link will no longer work.
              {invoiceToResend && (
                <span className="block mt-2 font-medium text-foreground">
                  Invoice: {invoiceToResend.invoice_number}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResendConfirmed}>
              Resend Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
