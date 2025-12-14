"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayments } from "@/hooks/use-payments";
import type { Payment } from "@/lib/types/payment";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "./payment-utils";

interface PaymentHistoryProps {
  invoiceId: string;
  currency: string;
}

/**
 * Payment History Component
 * Displays a table of all payments for an invoice
 */
export default function PaymentHistory({
  invoiceId,
  currency,
}: PaymentHistoryProps) {
  const { payments, loading, error } = usePayments(invoiceId);

  const getStatusIcon = (status: Payment["status"]) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "refunded":
      case "partially_refunded":
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case "disputed":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: Payment["status"]) => {
    switch (status) {
      case "succeeded":
        return "default";
      case "failed":
      case "canceled":
        return "destructive";
      case "pending":
      case "processing":
        return "secondary";
      case "refunded":
      case "partially_refunded":
      case "disputed":
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getPaymentMethodLabel = (method: Payment["payment_method"]) => {
    const labels: Record<Payment["payment_method"], string> = {
      stripe_checkout_card: "Card (Stripe)",
      stripe_checkout_bank: "Bank Account (Stripe)",
      stripe_checkout_wallet: "Digital Wallet (Stripe)",
      bank_transfer_manual: "Bank Transfer",
      other: "Other",
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading payment history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive py-4">
        Error loading payments: {error}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No payments recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Payment History</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Fees</TableHead>
            <TableHead>Net Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-medium">
                {formatDate(payment.received_at || payment.created_at)}
              </TableCell>
              <TableCell>{formatCurrency(payment.amount, currency)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getPaymentMethodLabel(payment.payment_method)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusIcon(payment.status)}
                  <Badge variant={getStatusBadgeVariant(payment.status)}>
                    {payment.status.replace("_", " ")}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground font-mono">
                {payment.payment_reference ||
                  payment.stripe_payment_intent_id?.slice(-8) ||
                  "-"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {payment.fees > 0
                  ? formatCurrency(payment.fees, currency)
                  : "-"}
              </TableCell>
              <TableCell className="font-medium">
                {payment.net_amount
                  ? formatCurrency(payment.net_amount, currency)
                  : formatCurrency(payment.amount, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
