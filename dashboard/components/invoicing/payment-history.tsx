"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayments } from "@/hooks/use-payments";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/types/payment";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowDownRight,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface PaymentHistoryProps {
  invoiceId: string;
  invoiceTotal?: number;
  currency?: string;
}

/**
 * Format currency based on currency code
 */
const formatCurrency = (amount: number, currency: string = "AUD"): string => {
  const currencyLocaleMap: Record<string, string> = {
    AUD: "en-AU",
    USD: "en-US",
    GBP: "en-GB",
    EUR: "de-DE",
    CAD: "en-CA",
    NZD: "en-NZ",
  };

  const locale = currencyLocaleMap[currency] || "en-AU";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(isNaN(amount) ? 0 : amount);
};

/**
 * Get display label for payment method
 */
const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    stripe_checkout_card: "Card",
    stripe_checkout_bank: "Bank Account",
    stripe_checkout_wallet: "Digital Wallet",
    bank_transfer_manual: "Bank Transfer",
    other: "Other",
  };
  return labels[method] || method;
};

/**
 * Get icon for payment method
 */
const PaymentMethodIcon = ({ method }: { method: PaymentMethod }) => {
  switch (method) {
    case "stripe_checkout_card":
      return <CreditCard className="h-4 w-4" />;
    case "stripe_checkout_bank":
    case "bank_transfer_manual":
      return <Banknote className="h-4 w-4" />;
    default:
      return <ArrowDownRight className="h-4 w-4" />;
  }
};

/**
 * Get status badge variant and icon
 */
const getStatusConfig = (
  status: PaymentStatus
): {
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
  label: string;
} => {
  switch (status) {
    case "succeeded":
      return {
        variant: "secondary",
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        label: "Succeeded",
      };
    case "pending":
      return {
        variant: "outline",
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: "Pending",
      };
    case "processing":
      return {
        variant: "default",
        icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" />,
        label: "Processing",
      };
    case "failed":
      return {
        variant: "destructive",
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: "Failed",
      };
    case "canceled":
      return {
        variant: "outline",
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: "Canceled",
      };
    case "refunded":
      return {
        variant: "outline",
        icon: <RefreshCw className="h-3 w-3 mr-1" />,
        label: "Refunded",
      };
    case "partially_refunded":
      return {
        variant: "outline",
        icon: <RefreshCw className="h-3 w-3 mr-1" />,
        label: "Partial Refund",
      };
    case "disputed":
      return {
        variant: "destructive",
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
        label: "Disputed",
      };
    default:
      return {
        variant: "outline",
        icon: null,
        label: status,
      };
  }
};

/**
 * Payment row component
 */
function PaymentRow({
  payment,
  currency,
}: {
  payment: Payment;
  currency: string;
}) {
  const statusConfig = getStatusConfig(payment.status);
  const paymentDate = payment.payment_date || payment.received_at || payment.created_at;

  return (
    <TableRow>
      <TableCell>
        {format(new Date(paymentDate), "MMM d, yyyy")}
        <span className="block text-xs text-muted-foreground">
          {format(new Date(paymentDate), "h:mm a")}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <PaymentMethodIcon method={payment.payment_method} />
          <span>{getPaymentMethodLabel(payment.payment_method)}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={statusConfig.variant} className="flex items-center w-fit">
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(payment.amount, currency)}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {payment.fees > 0 ? `-${formatCurrency(payment.fees, currency)}` : "-"}
      </TableCell>
      <TableCell className="text-right">
        {payment.payment_reference || "-"}
      </TableCell>
    </TableRow>
  );
}

/**
 * Payment History Component
 *
 * Displays payment history for an invoice with totals and remaining balance
 */
export default function PaymentHistory({
  invoiceId,
  invoiceTotal = 0,
  currency = "AUD",
}: PaymentHistoryProps) {
  const { payments, loading, error, totalPaid, remainingBalance } = usePayments(
    invoiceId,
    invoiceTotal
  );

  // Determine if we should show balance info (only if invoiceTotal was provided)
  const showBalanceInfo = invoiceTotal > 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load payment history</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasPayments = payments.length > 0;
  const isFullyPaid = showBalanceInfo && remainingBalance <= 0;

  // Calculate total fees from succeeded payments
  const totalFees = payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + (p.fees || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Payment History</CardTitle>
          {isFullyPaid && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Paid in Full
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards - only show if invoiceTotal is provided */}
        {showBalanceInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Invoice Total</p>
              <p className="text-lg font-semibold">
                {formatCurrency(invoiceTotal, currency)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(totalPaid, currency)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p
                className={`text-lg font-semibold ${
                  remainingBalance > 0
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {formatCurrency(remainingBalance, currency)}
              </p>
            </div>
            {totalFees > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Fees</p>
                <p className="text-lg font-semibold text-muted-foreground">
                  {formatCurrency(totalFees, currency)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Payments Table */}
        {hasPayments ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    currency={currency}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 border rounded-lg">
            <Banknote className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No payments recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Payments will appear here when received
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
