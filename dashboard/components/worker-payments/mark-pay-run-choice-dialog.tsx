"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useState } from "react";

export interface MarkPayRunChoiceOption {
  batchId: string;
  rangeLabel: string;
  amount: number;
}

interface MarkPayRunChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  options: MarkPayRunChoiceOption[];
  /** Called with at least one batch id; user selected which pay runs to settle in the next step. */
  onContinue: (batchIds: string[]) => void;
}

export function MarkPayRunChoiceDialog({
  open,
  onOpenChange,
  workerName,
  options,
  onContinue,
}: MarkPayRunChoiceDialogProps) {
  const { formatCurrency } = useOrganizationCurrency();
  /** Defaults to all runs selected each time this dialog mounts (parent unmounts when closed). */
  const [selectedBatchIds, setSelectedBatchIds] = useState(
    () => new Set(options.map((o) => o.batchId))
  );

  const toggleBatch = (batchId: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedBatchIds.size === options.length) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(options.map((o) => o.batchId)));
    }
  };

  const handleContinue = () => {
    if (selectedBatchIds.size === 0) return;
    onContinue(Array.from(selectedBatchIds));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription>
            {workerName} has unpaid amounts in {options.length} pay runs. Select which runs to
            include, then continue to choose jobs and record the payment in one step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Pay runs to settle</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-1 text-xs cursor-pointer"
              onClick={toggleAll}
            >
              {selectedBatchIds.size === options.length ? "Deselect all" : "Select all"}
            </Button>
          </div>
          <ul className="space-y-2 max-h-[min(320px,50vh)] overflow-y-auto rounded-md border divide-y">
            {options.map((opt) => (
              <li key={opt.batchId} className="flex items-start gap-3 px-3 py-2.5">
                <Checkbox
                  id={`pay-run-${opt.batchId}`}
                  checked={selectedBatchIds.has(opt.batchId)}
                  onCheckedChange={() => toggleBatch(opt.batchId)}
                  className="cursor-pointer mt-1"
                />
                <label
                  htmlFor={`pay-run-${opt.batchId}`}
                  className="min-w-0 flex-1 cursor-pointer select-none space-y-0.5"
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Pay run</p>
                  <p className="text-sm font-medium leading-snug">{opt.rangeLabel}</p>
                  <p className="font-mono text-sm tabular-nums">{formatCurrency(opt.amount)}</p>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={selectedBatchIds.size === 0}
            onClick={handleContinue}
          >
            {selectedBatchIds.size === 0 ? "Select at least one run" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
