"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useJobs } from "@/hooks/use-jobs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import useOrganization from "@/hooks/useOrganization";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import MarkPaymentPaidDialog from "./mark-payment-paid-dialog";
import PaymentDetailDialog from "./payment-detail-dialog";

type PaymentStatus =
  | "calculated"
  | "approved"
  | "processing"
  | "completed"
  | "paid"
  | "failed"
  | "cancelled";

const statusConfig: Record<
  PaymentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon?: React.ReactNode;
    className?: string;
  }
> = {
  calculated: {
    label: "Calculated",
    variant: "outline",
    icon: <Clock className="h-3 w-3 mr-1" />,
  },
  approved: {
    label: "Approved",
    variant: "secondary",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
    className: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  processing: {
    label: "Processing",
    variant: "secondary",
    icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
    className: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  },
  completed: {
    label: "Completed",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  paid: {
    label: "Paid",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3 mr-1" />,
  },
  cancelled: {
    label: "Cancelled",
    variant: "outline",
    icon: <XCircle className="h-3 w-3 mr-1" />,
    className: "text-muted-foreground",
  },
};

export default function PaymentHistoryList() {
  const { formatCurrency } = useOrganizationCurrency();
  const { organizationId } = useOrganization();
  const { jobs } = useJobs();
  const { paymentHistory, filterByDateRange, invalidate } =
    useWorkerPaymentHistory();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(
    null
  );
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [approvingBatchId, setApprovingBatchId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    return filterByDateRange(startDate || undefined, endDate || undefined);
  }, [startDate, endDate, filterByDateRange]);

  const handleViewDetails = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsDetailDialogOpen(true);
  };

  const handleExport = (payment: PaymentRecord) => {
    const csvContent = WorkerPaymentService.exportPaymentsToCSV(payment, jobs);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worker-payments-${payment.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApprove = async (batchId: string) => {
    if (!organizationId) return;

    setApprovingBatchId(batchId);
    try {
      await WorkerPaymentService.updatePaymentStatus(organizationId, {
        batchId,
        status: "approved",
      });
      toast.success("Payment batch approved");
      invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve payment"
      );
    } finally {
      setApprovingBatchId(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    const statusKey = (status || "calculated") as PaymentStatus;
    const config = statusConfig[statusKey] || statusConfig.calculated;

    return (
      <Badge
        variant={config.variant}
        className={cn("font-medium", config.className)}
      >
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            View calculated worker payments by date range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {paymentHistory.length === 0
                  ? "No payment calculations yet. Click 'Calculate Payments' to get started."
                  : "No payments found for the selected date range."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Workers</TableHead>
                    <TableHead className="text-right">Total Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Calculated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(
                          new Date(payment.dateRange.start),
                          "MMM d, yyyy"
                        )}{" "}
                        -{" "}
                        {format(new Date(payment.dateRange.end), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{payment.jobIds.length}</TableCell>
                      <TableCell>{payment.workerCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.totalPayment)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {format(
                          new Date(payment.calculatedAt),
                          "MMM d, yyyy HH:mm"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(payment)}
                          >
                            View Details
                          </Button>
                          {/* Approve button - only for calculated status */}
                          {payment.batch_id &&
                            (!payment.status ||
                              payment.status === "calculated") && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleApprove(payment.batch_id!)}
                                disabled={approvingBatchId === payment.batch_id}
                              >
                                {approvingBatchId === payment.batch_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Approve"
                                )}
                              </Button>
                            )}
                          {/* Mark as Paid button - for approved or processing status */}
                          {payment.batch_id &&
                            payment.status &&
                            ["approved", "processing"].includes(
                              payment.status
                            ) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedBatchId(payment.batch_id!);
                                  setIsMarkPaidDialogOpen(true);
                                }}
                              >
                                Mark as Paid
                              </Button>
                            )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExport(payment)}
                            title="Export to CSV"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPayment && (
        <PaymentDetailDialog
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          payment={selectedPayment}
        />
      )}

      {selectedBatchId && (
        <MarkPaymentPaidDialog
          open={isMarkPaidDialogOpen}
          onOpenChange={(open) => {
            setIsMarkPaidDialogOpen(open);
            if (!open) {
              setSelectedBatchId(null);
            }
          }}
          batchId={selectedBatchId}
          onSuccess={() => {
            // Invalidate cache to refresh payment history
            invalidate();
          }}
        />
      )}
    </>
  );
}
