"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import { useWorkerPaymentSummary } from "@/hooks/use-worker-payment-summary";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import useOrganization from "@/hooks/useOrganization";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { Calculator, Eye } from "lucide-react";
import { useState } from "react";
import CalculatePaymentDialog from "./calculate-payment-dialog";
import PaymentDetailDialog from "./payment-detail-dialog";

export default function WorkerPaymentSummary() {
  const { organizationId } = useOrganization();
  const { formatCurrency } = useOrganizationCurrency();
  const { calculatePayments } = useWorkerPayments();
  const { paymentHistory, addPayment } = useWorkerPaymentHistory();
  const { workerSummary } = useWorkerPaymentSummary();
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(
    null
  );
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const handleCalculatePayments = async (jobIds: string[]) => {
    if (!organizationId) return;

    const result = await calculatePayments(jobIds);
    if (result?.calculation) {
      // Save to database via service
      try {
        await WorkerPaymentService.savePayment(organizationId, result, jobIds);
        addPayment(result, jobIds);
      } catch (error) {
        console.error("Failed to save payment:", error);
        // Still add to local state for now, but log error
        addPayment(result, jobIds);
      }
    }
  };

  const handleViewDetails = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setIsDetailDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1" />
        <Button onClick={() => setIsCalculateDialogOpen(true)}>
          <Calculator className="mr-2 h-4 w-4" />
          Calculate Payments
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker Payment Summary</CardTitle>
          <CardDescription>
            Payments grouped by worker with totals and averages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workerSummary.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No payment calculations yet. Click &apos;Calculate Payments&apos;
              to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Total Payment</TableHead>
                  <TableHead className="text-right">Average per Job</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerSummary.map((summary) => {
                  // Find the most recent payment record that includes this worker
                  const relatedPayment = paymentHistory.find((p) =>
                    summary.jobs.some((jobId) => p.jobIds.includes(jobId))
                  );

                  return (
                    <TableRow key={summary.workerId}>
                      <TableCell className="font-medium">
                        {summary.workerName}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.jobCount}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(summary.totalPayment)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(summary.averagePayment)}
                      </TableCell>
                      <TableCell className="text-right">
                        {relatedPayment && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(relatedPayment)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
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
    </>
  );
}
