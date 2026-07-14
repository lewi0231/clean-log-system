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

export interface BulkYardOptionPrice {
  customerPrice: string;
  workerPrice: string;
}

interface PricingBulkYardOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldLabel: string;
  options: string[];
  availableLocations: Array<{ id: string; name: string }>;
  hasWorkers: boolean;
  showBothContexts: boolean;
  saving?: boolean;
  onSave: (
    locationId: string,
    locationName: string,
    pricesByOption: Record<string, BulkYardOptionPrice>,
    validUntil: string
  ) => Promise<boolean>;
}

interface BulkYardOverrideFormProps {
  fieldLabel: string;
  options: string[];
  sortedLocations: Array<{ id: string; name: string }>;
  hasWorkers: boolean;
  showBothContexts: boolean;
  saving: boolean;
  onSave: PricingBulkYardOverrideDialogProps["onSave"];
  onClose: () => void;
}

function BulkYardOverrideForm({
  fieldLabel,
  options,
  sortedLocations,
  hasWorkers,
  showBothContexts,
  saving,
  onSave,
  onClose,
}: BulkYardOverrideFormProps) {
  const [locationId, setLocationId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [workerPrice, setWorkerPrice] = useState("");

  const handleSave = async () => {
    const loc = sortedLocations.find((l) => l.id === locationId);
    if (!loc) return;

    const pricesByOption: Record<string, BulkYardOptionPrice> = {};
    for (const opt of options) {
      pricesByOption[opt] = {
        customerPrice,
        workerPrice,
      };
    }

    try {
      const saved = await onSave(locationId, loc.name, pricesByOption, validUntil);
      if (saved) {
        onClose();
      }
    } catch {
      // Parent surfaces errors via toast.
    }
  };

  const locationName = sortedLocations.find((l) => l.id === locationId)?.name;
  const canSave = Boolean(locationId && parsePriceString(customerPrice) !== undefined);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bulk yard override</DialogTitle>
        <DialogDescription>
          Apply the same pricing to all {options.length} options in <strong>{fieldLabel}</strong>{" "}
          for one yard.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Yard</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select yard" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              {sortedLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {locationId && (
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
                After this date, prices revert to the default for each option.
              </p>
            </div>

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
          {saving ? "Saving..." : locationName ? `Apply to ${locationName}` : "Apply override"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PricingBulkYardOverrideDialog({
  open,
  onOpenChange,
  fieldLabel,
  options,
  availableLocations,
  hasWorkers,
  showBothContexts,
  saving = false,
  onSave,
}: PricingBulkYardOverrideDialogProps) {
  const sortedLocations = useMemo(
    () => [...availableLocations].sort((a, b) => a.name.localeCompare(b.name)),
    [availableLocations]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <BulkYardOverrideForm
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
