"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { Job } from "@/lib/types";
import type { CalculateWorkerPaymentsResponse } from "@/lib/services/worker-payment.service";
import { format } from "date-fns";

interface PaymentRecord {
  id: string;
  dateRange: { start: string; end: string };
  jobIds: string[];
  totalPayment: number;
  workerCount: number;
  calculation: CalculateWorkerPaymentsResponse;
  calculatedAt: string;
}

interface PaymentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRecord;
  jobs: Job[];
}

export default function PaymentDetailDialog({
  open,
  onOpenChange,
  payment,
  jobs,
}: PaymentDetailDialogProps) {
  const { formatCurrency } = useOrganizationCurrency();

  const jobCalculations = payment.calculation.calculation.job_calculations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            Detailed breakdown of worker payment calculation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Date Range</div>
              <div className="font-medium">
                {format(new Date(payment.dateRange.start), "MMM d, yyyy")} -{" "}
                {format(new Date(payment.dateRange.end), "MMM d, yyyy")}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Payment</div>
              <div className="text-2xl font-bold">
                {formatCurrency(payment.totalPayment)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Jobs</div>
              <div className="font-medium">{payment.jobIds.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Workers</div>
              <div className="font-medium">{payment.workerCount}</div>
            </div>
          </div>

          <Separator />

          {/* Job Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Job Breakdown</h3>
            <div className="space-y-6">
              {jobCalculations.map((calc) => {
                const job = jobs.find((j) => j.id === calc.job_id);
                if (!job) return null;
                return (
                  <div key={calc.job_id} className="border rounded-lg p-4">
                    <div className="mb-4">
                      <div className="font-semibold">
                        Job -{" "}
                        {format(new Date(job.completed_at), "MMM d, yyyy")}
                        {job.location?.name && ` - ${job.location.name}`}
                      </div>
                      {job.workers && job.workers.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Workers: {job.workers.map((w) => w.name).join(", ")}
                        </div>
                      )}
                    </div>

                    {/* Line Items */}
                    {calc.line_items.length > 0 && (
                      <div className="mb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Field</TableHead>
                              <TableHead className="text-right">
                                Quantity
                              </TableHead>
                              <TableHead className="text-right">
                                Unit Price
                              </TableHead>
                              <TableHead className="text-right">
                                Total
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {calc.line_items.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  {item.field_label}
                                  {item.option_value && (
                                    <span className="text-muted-foreground ml-2">
                                      ({item.option_value})
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(item.unit_price)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(item.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium">
                          {formatCurrency(calc.subtotal)}
                        </span>
                      </div>
                      {calc.total_adjustments !== 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Adjustments:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(calc.total_adjustments)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-semibold pt-2 border-t">
                        <span>Total Payment:</span>
                        <span>{formatCurrency(calc.total_worker_payment)}</span>
                      </div>
                    </div>

                    {/* Applied Rules */}
                    {calc.applied_rules.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-sm font-medium mb-2">
                          Applied Pricing Rules:
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {calc.applied_rules.map((rule, idx) => (
                            <div key={idx}>
                              {rule.pricing_type} -{" "}
                              {formatCurrency(rule.amount)}
                              {rule.scope !== "global" && (
                                <span className="ml-2">
                                  ({rule.scope} scope)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
