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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  FileText,
  Mail,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Custom hook for debouncing a value
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Calculate the number of days an invoice is overdue
 * Returns 0 if invoice is not overdue (due date is today or in the future)
 */
const getDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const today = new Date();
  // Set both to midnight for accurate day comparison
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Get the color variant for overdue badge based on days overdue
 * Yellow (1-7 days), Orange (8-14 days), Red (15+ days)
 */
const getOverdueSeverity = (
  daysOverdue: number
): "warning" | "orange" | "destructive" => {
  if (daysOverdue <= 7) return "warning";
  if (daysOverdue <= 14) return "orange";
  return "destructive";
};

/**
 * Badge component to display days overdue with color coding
 */
function OverdueBadge({ daysOverdue }: { daysOverdue: number }) {
  const severity = getOverdueSeverity(daysOverdue);

  // Map severity to Tailwind classes
  const colorClasses = {
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    destructive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${colorClasses[severity]}`}
      title={`${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`}
    >
      <AlertTriangle className="h-3 w-3" />
      {daysOverdue}d
    </span>
  );
}

/**
 * Status filter options for the dropdown
 */
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending Review" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

interface InvoiceListProps {
  onInvoiceClick?: (invoice: InvoiceWithJobs) => void;
  initialStatusFilter?: string;
  isAdmin?: boolean;
}

export default function InvoiceList({
  onInvoiceClick,
  initialStatusFilter,
  isAdmin = false,
}: InvoiceListProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showTests, setShowTests] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatusFilter || "all"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  // Debounce search query to avoid too many API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, statusFilter, debouncedSearch, showTests]);

  const { invoices, loading, error, refetch, pagination } = useInvoices(
    startDate || undefined,
    endDate || undefined,
    showTests,
    debouncedSearch || undefined,
    statusFilter !== "all" ? statusFilter : undefined,
    currentPage,
    pageSize
  );

  // Invoices are already filtered by the backend
  const filteredInvoices = invoices;
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [invoiceToResend, setInvoiceToResend] =
    useState<InvoiceWithJobs | null>(null);
  const [approvingInvoiceId, setApprovingInvoiceId] = useState<string | null>(
    null
  );
  const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(
    null
  );
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(
    null
  );
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const getStatusBadge = (invoice: InvoiceWithJobs) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      draft: "outline",
      pending_review: "secondary",
      sent: "default",
      paid: "secondary",
      overdue: "destructive",
      cancelled: "outline",
    };

    const status = invoice.status;
    const isPaid = invoice.paid_at !== null;
    const daysOverdue =
      status === "overdue" ? getDaysOverdue(invoice.due_date) : 0;

    // Format status display
    const statusDisplay =
      status === "pending_review"
        ? "Pending Review"
        : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

    return (
      <div className="flex items-center gap-2">
        {invoice.is_test && (
          <Badge variant="destructive" className="text-[10px] tracking-wide">
            TEST
          </Badge>
        )}
        <Badge variant={variants[status] || "default"}>{statusDisplay}</Badge>
        {isPaid && (
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Paid" />
        )}
        {status === "overdue" && daysOverdue > 0 && (
          <OverdueBadge daysOverdue={daysOverdue} />
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
    setStatusFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const hasFilters =
    startDate ||
    endDate ||
    (statusFilter && statusFilter !== "all") ||
    searchQuery;

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

  const isTestInvoice = (invoice: InvoiceWithJobs) => invoice.is_test === true;

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

  const handleSendReminder = async (
    e: React.MouseEvent,
    invoice: InvoiceWithJobs
  ) => {
    e.stopPropagation();

    try {
      setSendingReminderId(invoice.id);
      log.info("Sending invoice reminder", { invoiceId: invoice.id });

      await InvoiceService.sendReminder(invoice.id, invoice.organization_id);

      // Refetch invoices to get updated reminder tracking
      await refetch();

      log.info("Invoice reminder sent successfully");
      toast.success("Reminder sent", {
        description: `Payment reminder sent for invoice ${invoice.invoice_number}.`,
      });
    } catch (err) {
      log.error("Failed to send invoice reminder", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to send reminder", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleApproveInvoice = async (
    e: React.MouseEvent,
    invoiceId: string
  ) => {
    e.stopPropagation();
    try {
      setApprovingInvoiceId(invoiceId);
      log.info("Approving invoice", { invoiceId });

      // Approve: Change status from pending_review to draft (ready to send)
      await InvoiceService.updateStatus(invoiceId, "draft");

      await refetch();

      log.info("Invoice approved successfully");
      toast.success("Invoice approved", {
        description: "Invoice is now ready to send.",
      });
    } catch (err) {
      log.error("Failed to approve invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to approve invoice", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setApprovingInvoiceId(null);
    }
  };

  const handleRejectInvoice = async (
    e: React.MouseEvent,
    invoiceId: string
  ) => {
    e.stopPropagation();
    try {
      setRejectingInvoiceId(invoiceId);
      log.info("Rejecting invoice", { invoiceId });

      // Reject: Change status to cancelled
      await InvoiceService.updateStatus(invoiceId, "cancelled");

      await refetch();

      log.info("Invoice rejected successfully");
      toast.success("Invoice rejected", {
        description: "Invoice has been cancelled.",
      });
    } catch (err) {
      log.error("Failed to reject invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Failed to reject invoice", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setRejectingInvoiceId(null);
    }
  };

  // Bulk selection handlers
  const pendingReviewInvoices = filteredInvoices.filter(
    (inv) => inv.status === "pending_review"
  );
  const selectedPendingReview = Array.from(selectedInvoiceIds).filter((id) =>
    pendingReviewInvoices.some((inv) => inv.id === id)
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select pending_review invoices that are visible
      const pendingIds = pendingReviewInvoices.map((inv) => inv.id);
      setSelectedInvoiceIds(new Set(pendingIds));
    } else {
      setSelectedInvoiceIds(new Set());
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoiceIds);
    if (checked) {
      newSelected.add(invoiceId);
    } else {
      newSelected.delete(invoiceId);
    }
    setSelectedInvoiceIds(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedPendingReview.length === 0) return;

    try {
      setBulkProcessing(true);
      log.info("Bulk approving invoices", { count: selectedPendingReview.length });

      let successCount = 0;
      let errorCount = 0;

      for (const invoiceId of selectedPendingReview) {
        try {
          await InvoiceService.updateStatus(invoiceId, "draft");
          successCount++;
        } catch {
          errorCount++;
        }
      }

      await refetch();
      setSelectedInvoiceIds(new Set());

      if (successCount > 0) {
        toast.success(`Approved ${successCount} invoice(s)`, {
          description:
            errorCount > 0 ? `${errorCount} failed to approve` : undefined,
        });
      } else if (errorCount > 0) {
        toast.error(`Failed to approve ${errorCount} invoice(s)`);
      }
    } catch (err) {
      log.error("Bulk approve failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Bulk approve failed");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedPendingReview.length === 0) return;

    try {
      setBulkProcessing(true);
      log.info("Bulk rejecting invoices", { count: selectedPendingReview.length });

      let successCount = 0;
      let errorCount = 0;

      for (const invoiceId of selectedPendingReview) {
        try {
          await InvoiceService.updateStatus(invoiceId, "cancelled");
          successCount++;
        } catch {
          errorCount++;
        }
      }

      await refetch();
      setSelectedInvoiceIds(new Set());

      if (successCount > 0) {
        toast.success(`Rejected ${successCount} invoice(s)`, {
          description:
            errorCount > 0 ? `${errorCount} failed to reject` : undefined,
        });
      } else if (errorCount > 0) {
        toast.error(`Failed to reject ${errorCount} invoice(s)`);
      }
    } catch (err) {
      log.error("Bulk reject failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Bulk reject failed");
    } finally {
      setBulkProcessing(false);
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
        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
          {/* Search */}
          <div className="w-full sm:w-64 space-y-2">
            <Label htmlFor="search-invoice" className="text-sm">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-invoice"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice #"
                className="pl-9"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48 space-y-2">
            <Label htmlFor="status-filter" className="text-sm">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filters */}
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

          {isAdmin && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <Label htmlFor="show-test-invoices" className="text-sm">
                Show test data
              </Label>
              <Switch
                id="show-test-invoices"
                checked={showTests}
                onCheckedChange={setShowTests}
              />
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedInvoiceIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedPendingReview.length} pending review invoice(s) selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={bulkProcessing || selectedPendingReview.length === 0}
              >
                <Check className="mr-1 h-3 w-3" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkReject}
                disabled={bulkProcessing || selectedPendingReview.length === 0}
              >
                <X className="mr-1 h-3 w-3" />
                Reject All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedInvoiceIds(new Set())}
                disabled={bulkProcessing}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        {/* Invoice Table */}
        {filteredInvoices.length === 0 ? (
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
                  {pendingReviewInvoices.length > 0 && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          pendingReviewInvoices.length > 0 &&
                          pendingReviewInvoices.every((inv) =>
                            selectedInvoiceIds.has(inv.id)
                          )
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all pending review invoices"
                      />
                    </TableHead>
                  )}
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
                {filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className={
                      onInvoiceClick ? "cursor-pointer hover:bg-muted/50" : ""
                    }
                    onClick={() => onInvoiceClick?.(invoice)}
                  >
                    {pendingReviewInvoices.length > 0 && (
                      <TableCell className="w-12">
                        {invoice.status === "pending_review" && (
                          <Checkbox
                            checked={selectedInvoiceIds.has(invoice.id)}
                            onCheckedChange={(checked) => {
                              handleSelectInvoice(invoice.id, checked === true);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select invoice ${invoice.invoice_number}`}
                          />
                        )}
                      </TableCell>
                    )}
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
                        {invoice.status === "pending_review" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) =>
                                handleApproveInvoice(e, invoice.id)
                              }
                              disabled={
                                approvingInvoiceId === invoice.id ||
                                rejectingInvoiceId === invoice.id
                              }
                              className="cursor-pointer"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              {approvingInvoiceId === invoice.id
                                ? "Approving..."
                                : "Approve"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) =>
                                handleRejectInvoice(e, invoice.id)
                              }
                              disabled={
                                approvingInvoiceId === invoice.id ||
                                rejectingInvoiceId === invoice.id
                              }
                              className="cursor-pointer"
                            >
                              <X className="mr-1 h-3 w-3" />
                              {rejectingInvoiceId === invoice.id
                                ? "Rejecting..."
                                : "Reject"}
                            </Button>
                          </>
                        )}
                        {invoice.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleSendInvoice(e, invoice.id)}
                            disabled={
                              sendingInvoiceId === invoice.id ||
                              isTestInvoice(invoice)
                            }
                            className="cursor-pointer"
                            title={
                              isTestInvoice(invoice)
                                ? "Test invoices cannot be sent"
                                : undefined
                            }
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
                            disabled={
                              sendingInvoiceId === invoice.id ||
                              isTestInvoice(invoice)
                            }
                            className="cursor-pointer"
                            title={
                              isTestInvoice(invoice)
                                ? "Test invoices cannot be resent"
                                : undefined
                            }
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            {sendingInvoiceId === invoice.id
                              ? "Resending..."
                              : "Resend"}
                          </Button>
                        )}
                        {invoice.status === "overdue" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => handleSendReminder(e, invoice)}
                            disabled={
                              sendingReminderId === invoice.id ||
                              isTestInvoice(invoice)
                            }
                            className="cursor-pointer"
                            title={
                              isTestInvoice(invoice)
                                ? "Test invoices cannot send reminders"
                                : "Send payment reminder email"
                            }
                          >
                            <Bell className="mr-1 h-3 w-3" />
                            {sendingReminderId === invoice.id
                              ? "Sending..."
                              : "Remind"}
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

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, pagination.total_count)} of{" "}
              {pagination.total_count} invoices
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))
                }
                disabled={currentPage >= pagination.total_pages}
              >
                Next
              </Button>
            </div>
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
