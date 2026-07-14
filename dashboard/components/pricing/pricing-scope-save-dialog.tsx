"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";

export interface MultiYardOverrideSummaryRow {
  yardName: string;
  customerPrice: number;
  workerPrice: number | null;
  validUntil: string | null;
  revertsToCustomer: number | null;
}

interface PricingScopeSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  optionLabel: string;
  rows: MultiYardOverrideSummaryRow[];
  onConfirm: () => Promise<void>;
  saving?: boolean;
}

export function PricingScopeSaveDialog({
  open,
  onOpenChange,
  optionLabel,
  rows,
  onConfirm,
  saving = false,
}: PricingScopeSaveDialogProps) {
  const { formatCurrency } = useOrganizationCurrency();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm yard overrides</DialogTitle>
          <DialogDescription>
            These overrides will be saved for <strong>{optionLabel}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Yard</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Reverts to</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.yardName}>
                <TableCell>{row.yardName}</TableCell>
                <TableCell>{formatCurrency(row.customerPrice)}</TableCell>
                <TableCell>
                  {row.workerPrice != null ? formatCurrency(row.workerPrice) : "–"}
                </TableCell>
                <TableCell>{row.validUntil || "—"}</TableCell>
                <TableCell>
                  {row.revertsToCustomer != null ? formatCurrency(row.revertsToCustomer) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Confirm and save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
