"use client";

import { PricingScopeChip } from "@/components/pricing/pricing-scope-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import type { ScopeChipVariant } from "@/lib/pricing-scope-display";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export interface YardOverrideDraft {
  draftId: string;
  locationId: string;
  locationName: string;
  customerPrice: string;
  workerPrice: string;
  validUntil: string;
  customerRuleId?: string;
  workerRuleId?: string;
}

export interface ExistingOverrideRow {
  locationId: string;
  locationName: string;
  customerPrice: number;
  workerPrice: number | null;
  validUntil: string | null;
  customerRuleId?: string;
  workerRuleId?: string;
  isActive?: boolean;
  revertsToCustomer?: number | null;
}

interface PricingScopeControlsProps {
  chipVariant: ScopeChipVariant;
  inheritedLabel?: string | null;
  overrideCount: number;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  existingOverrides: ExistingOverrideRow[];
  availableLocations: Array<{ id: string; name: string }>;
  usedLocationIds: Set<string>;
  orgDefaultCustomer: number | null;
  orgDefaultWorker: number | null;
  previewActive: boolean;
  disabled?: boolean;
  isMobile?: boolean;
  hasWorkers: boolean;
  draftOverrides: YardOverrideDraft[];
  onAddDraftOverride: (locationId: string, locationName: string) => void;
  onUpdateDraftOverride: (
    draftId: string,
    patch: Partial<Pick<YardOverrideDraft, "customerPrice" | "workerPrice" | "validUntil">>
  ) => void;
  onRemoveDraftOverride: (draftId: string) => void;
  onDeleteExistingOverride: (row: ExistingOverrideRow) => Promise<void>;
  onSaveOverrides: () => Promise<void>;
  saving?: boolean;
}

function OverridePanelContent({
  existingOverrides,
  availableLocations,
  usedLocationIds,
  orgDefaultCustomer,
  orgDefaultWorker,
  previewActive,
  disabled,
  hasWorkers,
  draftOverrides,
  onAddDraftOverride,
  onUpdateDraftOverride,
  onRemoveDraftOverride,
  onDeleteExistingOverride,
  onSaveOverrides,
  saving,
  formatCurrency,
}: Omit<
  PricingScopeControlsProps,
  "chipVariant" | "inheritedLabel" | "overrideCount" | "expanded" | "onExpandedChange" | "isMobile"
> & { formatCurrency: (n: number) => string }) {
  const [addLocationId, setAddLocationId] = useState<string>("");
  const visibleExisting = existingOverrides.slice(0, 3);
  const hiddenCount = Math.max(0, existingOverrides.length - 3);
  const [showAllExisting, setShowAllExisting] = useState(false);
  const displayedExisting = showAllExisting ? existingOverrides : visibleExisting;

  const unusedLocations = availableLocations.filter((loc) => !usedLocationIds.has(loc.id));

  const handleAdd = () => {
    const loc = availableLocations.find((l) => l.id === addLocationId);
    if (loc) {
      onAddDraftOverride(loc.id, loc.name);
      setAddLocationId("");
    }
  };

  return (
    <div className="space-y-3 pt-2 border-t mt-2">
      {previewActive && (
        <p className="text-xs text-muted-foreground">
          Edits below update <strong>All yards</strong> default — use overrides for a specific yard.
        </p>
      )}

      {displayedExisting.map((row) => (
        <div
          key={`${row.locationId}-${row.customerRuleId ?? row.workerRuleId}`}
          className={`rounded-md border p-2 space-y-1 text-sm ${row.isActive === false ? "opacity-60" : ""}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{row.locationName}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={disabled || saving}
              onClick={() => onDeleteExistingOverride(row)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Customer {formatCurrency(row.customerPrice)}
            {row.workerPrice != null && hasWorkers && (
              <> · Worker {formatCurrency(row.workerPrice)}</>
            )}
            {row.validUntil && <> · Until {row.validUntil}</>}
          </div>
          {row.revertsToCustomer != null && row.validUntil && (
            <div className="text-xs text-muted-foreground">
              Reverts to {formatCurrency(row.revertsToCustomer)} (All yards)
            </div>
          )}
        </div>
      ))}

      {hiddenCount > 0 && !showAllExisting && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => setShowAllExisting(true)}
        >
          View all overrides ({existingOverrides.length})
        </Button>
      )}

      {draftOverrides.map((draft) => (
        <div key={draft.draftId} className="rounded-md border p-2 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{draft.locationName}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onRemoveDraftOverride(draft.draftId)}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Customer</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.customerPrice}
                onChange={(e) =>
                  onUpdateDraftOverride(draft.draftId, { customerPrice: e.target.value })
                }
                className="h-8 text-sm"
                disabled={saving}
              />
            </div>
            {hasWorkers && (
              <div>
                <Label className="text-xs">Worker</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.workerPrice}
                  onChange={(e) =>
                    onUpdateDraftOverride(draft.draftId, { workerPrice: e.target.value })
                  }
                  className="h-8 text-sm"
                  disabled={saving}
                />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Valid until (optional)</Label>
            <Input
              type="date"
              value={draft.validUntil}
              onChange={(e) => onUpdateDraftOverride(draft.draftId, { validUntil: e.target.value })}
              className="h-8 text-sm"
              disabled={saving}
            />
            {draft.validUntil && orgDefaultCustomer != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Reverts to {formatCurrency(orgDefaultCustomer)} (All yards)
              </p>
            )}
          </div>
        </div>
      ))}

      {!disabled && unusedLocations.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Add yard override</Label>
            <Select value={addLocationId} onValueChange={setAddLocationId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select yard" />
              </SelectTrigger>
              <SelectContent>
                {unusedLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            disabled={!addLocationId || saving}
            onClick={handleAdd}
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      )}

      {draftOverrides.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={onSaveOverrides} disabled={saving}>
            {saving ? "Saving..." : `Save overrides (${draftOverrides.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

export function PricingScopeControls(props: PricingScopeControlsProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const {
    chipVariant,
    inheritedLabel,
    overrideCount,
    expanded,
    onExpandedChange,
    isMobile,
    disabled,
  } = props;

  const summary = (
    <div className="flex flex-wrap items-center gap-2">
      <PricingScopeChip variant={chipVariant} inheritedLabel={inheritedLabel} />
      {overrideCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {overrideCount} yard override{overrideCount === 1 ? "" : "s"}
        </Badge>
      )}
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          Manage overrides
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {summary}
        <Sheet open={expanded} onOpenChange={onExpandedChange}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Yard overrides</SheetTitle>
              <SheetDescription>
                Set yard-specific prices. Org default applies everywhere else.
              </SheetDescription>
            </SheetHeader>
            <OverridePanelContent {...props} formatCurrency={formatCurrency} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="col-span-full pt-1 pb-2">
      {summary}
      {expanded && <OverridePanelContent {...props} formatCurrency={formatCurrency} />}
    </div>
  );
}
