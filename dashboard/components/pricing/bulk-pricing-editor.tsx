"use client";

import { useQueryClient } from "@tanstack/react-query";

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
import { log } from "@/lib/logger";
import { PricingService } from "@/lib/services";
import type { FieldConfig } from "@clean-log/shared";
import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

interface BulkPricingEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldConfigs: FieldConfig[];
  locationHierarchyId: string | null;
  locationId: string | null;
  effectiveDate: string | null;
  onApplied?: () => void;
  organizationId: string | null;
}

export function BulkPricingEditor({
  open,
  onOpenChange,
  fieldConfigs,
  locationHierarchyId,
  locationId,
  effectiveDate,
  onApplied,
  organizationId,
}: BulkPricingEditorProps) {
  const queryClient = useQueryClient();
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectableFields = useMemo(
    () =>
      fieldConfigs.filter((fc) =>
        ["number", "boolean"].includes(fc.field_type)
      ),
    [fieldConfigs]
  );

  const effectiveText = effectiveDate
    ? new Date(effectiveDate).toLocaleDateString()
    : "immediately";

  const handleToggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((id) => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleApply = async () => {
    if (!organizationId) {
      setError("Organization not loaded yet.");
      return;
    }

    if (!selectedFields.length) {
      setError("Select at least one field.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Enter a valid price.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      for (const fieldId of selectedFields) {
        const field = fieldConfigs.find((fc) => fc.id === fieldId);
        if (!field) continue;

        await PricingService.upsertRule({
          organization_id: organizationId,
          scope: "field",
          pricing_type: field.field_type === "boolean" ? "fixed" : "unit",
          field_config_id: fieldId,
          base_price: parsedAmount,
          currency: "USD",
          location_hierarchy_id: locationHierarchyId,
          location_id: locationId,
          effective_at: effectiveDate ?? undefined,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["field-pricing", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["pricing-history", organizationId] });
      onApplied?.();
      setSelectedFields([]);
      setAmount("");
      onOpenChange(false);
    } catch (err) {
      log.error("Failed to bulk update pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
        fieldCount: selectedFields.length,
      });
      setError(
        err instanceof Error ? err.message : "Failed to bulk update pricing."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk edit pricing</DialogTitle>
          <DialogDescription>
            Apply a single customer price across multiple fields. Changes take
            effect {effectiveText}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">Fields to update</Label>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
              {selectableFields.map((field) => (
                <label
                  key={field.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={() => handleToggleField(field.id)}
                  />
                  <span>
                    {field.label}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({field.field_type})
                    </span>
                  </span>
                </label>
              ))}
              {selectableFields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No numeric or boolean fields available.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>New customer price</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Applies to {selectedFields.length} field
              {selectedFields.length === 1 ? "" : "s"} in the current location
              scope.
            </p>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Snapshot preview</p>
            {selectedFields.length ? (
              <div className="mt-2 space-y-1">
                <p>
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary" />
                  {selectedFields.length} field
                  {selectedFields.length === 1 ? "" : "s"} will switch to{" "}
                  <span className="font-semibold">
                    {formatCurrency(parseFloat(amount) || 0)}
                  </span>
                  .
                </p>
                <p>
                  Overrides will inherit to{" "}
                  {locationHierarchyId ? "the selected node" : "all locations"}.
                </p>
              </div>
            ) : (
              <p>Select fields to preview changes.</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isSaving}>
            {isSaving ? "Applying..." : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(isNaN(value) ? 0 : value);
