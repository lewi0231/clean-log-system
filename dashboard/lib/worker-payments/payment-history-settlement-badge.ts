/**
 * History list settlement labels (S2 period-accrual §4.1).
 * Batch `completed` = recorded paid; line items use `paid`.
 */
export type SettlementBadgeKey = "paid" | "cancelled" | "unpaid" | "failed";

export interface SettlementBadgeSpec {
  key: SettlementBadgeKey;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  showUnpaidTooltip: boolean;
}

export function settlementBadgeForBatchStatus(status?: string): SettlementBadgeSpec {
  const s = status ?? "calculated";
  if (s === "completed" || s === "paid") {
    return {
      key: "paid",
      label: "Paid",
      variant: "default",
      className: "bg-green-500/10 text-green-700 border-green-200",
      showUnpaidTooltip: false,
    };
  }
  if (s === "cancelled") {
    return {
      key: "cancelled",
      label: "Cancelled",
      variant: "outline",
      className: "text-muted-foreground",
      showUnpaidTooltip: false,
    };
  }
  if (s === "failed") {
    return {
      key: "failed",
      label: "Unpaid",
      variant: "destructive",
      showUnpaidTooltip: true,
    };
  }
  return {
    key: "unpaid",
    label: "Unpaid",
    variant: "outline",
    showUnpaidTooltip: true,
  };
}

export function canMarkBatchAsPaidFromStatus(
  status: PaymentStatusForMarkPaid | undefined
): boolean {
  if (status === "completed" || status === "cancelled" || status === "paid") return false;
  if (status === "failed") return false;
  return true;
}

/** Batch + legacy client values seen on `PaymentRecord.status`. */
export type PaymentStatusForMarkPaid =
  | "calculated"
  | "approved"
  | "processing"
  | "completed"
  | "paid"
  | "failed"
  | "cancelled"
  | undefined;
