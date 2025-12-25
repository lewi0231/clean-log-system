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
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { format } from "date-fns";
import { Calendar, CheckCircle2, Download } from "lucide-react";
import { useMemo, useState } from "react";
import CalculatePaymentDialog from "./calculate-payment-dialog";
import MarkPaymentPaidDialog from "./mark-payment-paid-dialog";
import PaymentDetailDialog from "./payment-detail-dialog";

export default function PaymentHistoryList() {
  const { formatCurrency } = useOrganizationCurrency();
  const { jobs } = useJobs();
  const { calculatePayments } = useWorkerPayments();
  const { paymentHistory, addPayment, filterByDateRange, invalidate } =
    useWorkerPaymentHistory();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(
    null
  );
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);

  const handleCalculatePayments = async (jobIds: string[]) => {
    const result = await calculatePayments(jobIds);
    if (result?.calculation) {
      addPayment(result, jobIds);
    }
  };

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

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" />
        <Button onClick={() => setIsCalculateDialogOpen(true)}>
          <Calendar className="mr-2 h-4 w-4" />
          Calculate Payments
        </Button>
      </div>

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
                      <TableCell>
                        {payment.status ? (
                          <Badge
                            variant={
                              payment.status === "paid"
                                ? "default"
                                : payment.status === "approved"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {payment.status === "paid" && (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            {payment.status.charAt(0).toUpperCase() +
                              payment.status.slice(1)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Calculated</Badge>
                        )}
                      </TableCell>
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
                          {payment.batch_id &&
                            (!payment.status || payment.status !== "paid") && (
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

      <CalculatePaymentDialog
        open={isCalculateDialogOpen}
        onOpenChange={setIsCalculateDialogOpen}
        onCalculate={handleCalculatePayments}
      />

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
