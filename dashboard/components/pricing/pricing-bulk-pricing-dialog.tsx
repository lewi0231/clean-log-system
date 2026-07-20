"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign } from "lucide-react";
import { useMemo, useState } from "react";
import { parsePriceString } from "@/lib/pricing-utils";

/** Sentinel Select value for org-wide (All yards) defaults. */
export const BULK_PRICING_ALL_YARDS = "__all_yards__";

export interface BulkOptionPrice {
  customerPrice: string;
  workerPrice: string;
}

export type BulkPricingScope =
  | { type: "all-yards" }
  | { type: "yard"; locationId: string; locationName: string };

interface PricingBulkPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldLabel: string;
  options: string[];
  availableLocations: Array<{ id: string; name: string }>;
  hasWorkers: boolean;
  showBothContexts: boolean;
  saving?: boolean;
  onSave: (
    scope: BulkPricingScope,
    pricesByOption: Record<string, BulkOptionPrice>,
    validUntil: string
  ) => Promise<boolean>;
}

interface BulkPricingFormProps {
  fieldLabel: string;
  options: string[];
  sortedLocations: Array<{ id: string; name: string }>;
  hasWorkers: boolean;
  showBothContexts: boolean;
  saving: boolean;
  onSave: PricingBulkPricingDialogProps["onSave"];
  onClose: () => void;
}

function BulkPricingForm({
  fieldLabel,
  options,
  sortedLocations,
  hasWorkers,
  showBothContexts,
  saving,
  onSave,
  onClose,
}: BulkPricingFormProps) {
  const [scopeValue, setScopeValue] = useState(BULK_PRICING_ALL_YARDS);
  const [validUntil, setValidUntil] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [workerPrice, setWorkerPrice] = useState("");

  const isAllYards = scopeValue === BULK_PRICING_ALL_YARDS;
  const selectedYard = sortedLocations.find((l) => l.id === scopeValue);
  const scopeReady = Boolean(scopeValue);

  const handleSave = async () => {
    if (!scopeValue) return;

    const pricesByOption: Record<string, BulkOptionPrice> = {};
    for (const opt of options) {
      pricesByOption[opt] = {
        customerPrice,
        workerPrice,
      };
    }

    let scope: BulkPricingScope;
    if (isAllYards) {
      scope = { type: "all-yards" };
    } else if (!selectedYard) {
      return;
    } else {
      scope = {
        type: "yard",
        locationId: selectedYard.id,
        locationName: selectedYard.name,
      };
    }

    // Valid until only applies to yard overrides
    const until = isAllYards ? "" : validUntil;

    try {
      const saved = await onSave(scope, pricesByOption, until);
      if (saved) {
        onClose();
      }
    } catch {
      // Parent surfaces errors via toast.
    }
  };

  const canSave = Boolean(scopeReady && parsePriceString(customerPrice) !== undefined);

  const applyLabel = isAllYards
    ? "Apply as All yards default"
    : selectedYard
      ? `Apply to ${selectedYard.name}`
      : "Apply pricing";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bulk pricing</DialogTitle>
        <DialogDescription>
          Apply the same price to all {options.length} options in <strong>{fieldLabel}</strong> —
          either as the All yards default or as a yard override.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Apply to</Label>
          <Select value={scopeValue} onValueChange={setScopeValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose scope" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value={BULK_PRICING_ALL_YARDS}>All yards (default)</SelectItem>
              {sortedLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {isAllYards
              ? "Sets the default price used when no yard override exists."
              : scopeReady
                ? "Overrides the All yards default for this yard only."
                : "Use All yards when every option shares the same default price."}
          </p>
        </div>

        {scopeReady && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-customer-price">Customer price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="bulk-customer-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={customerPrice}
                    onChange={(e) => setCustomerPrice(e.target.value)}
                    className="pl-9"
                    disabled={saving}
                  />
                </div>
              </div>
              {showBothContexts && hasWorkers && (
                <div className="space-y-2">
                  <Label htmlFor="bulk-worker-price">Worker payment</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="bulk-worker-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={workerPrice}
                      onChange={(e) => setWorkerPrice(e.target.value)}
                      className="pl-9"
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
            </div>

            {!isAllYards && (
              <div className="space-y-2">
                <Label htmlFor="bulk-valid-until">Valid until (optional)</Label>
                <Input
                  id="bulk-valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  After this date, prices revert to the All yards default for each option.
                </p>
              </div>
            )}

            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                This will set the same price for:{" "}
                <span className="font-medium text-foreground">
                  {options.slice(0, 3).join(", ")}
                  {options.length > 3 && ` and ${options.length - 3} more`}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? "Saving..." : applyLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PricingBulkPricingDialog({
  open,
  onOpenChange,
  fieldLabel,
  options,
  availableLocations,
  hasWorkers,
  showBothContexts,
  saving = false,
  onSave,
}: PricingBulkPricingDialogProps) {
  const sortedLocations = useMemo(
    () => [...availableLocations].sort((a, b) => a.name.localeCompare(b.name)),
    [availableLocations]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <BulkPricingForm
            fieldLabel={fieldLabel}
            options={options}
            sortedLocations={sortedLocations}
            hasWorkers={hasWorkers}
            showBothContexts={showBothContexts}
            saving={saving}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
