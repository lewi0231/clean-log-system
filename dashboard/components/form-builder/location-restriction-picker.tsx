"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface LocationRestrictionOption {
  id: string;
  name: string;
  active?: boolean;
}

interface LocationRestrictionPickerProps {
  locations: LocationRestrictionOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  idPrefix: string;
  emptyMessage?: string;
}

/**
 * Visible checkboxes for restricting a field to locations, with Select all / Deselect all.
 */
export function LocationRestrictionPicker({
  locations,
  selectedIds,
  onChange,
  idPrefix,
  emptyMessage = "No locations available. Create locations first.",
}: LocationRestrictionPickerProps) {
  const activeLocations = locations.filter((loc) => loc.active !== false);
  const allSelected =
    activeLocations.length > 0 && activeLocations.every((loc) => selectedIds.includes(loc.id));

  if (activeLocations.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline cursor-pointer"
          onClick={() => {
            onChange(allSelected ? [] : activeLocations.map((loc) => loc.id));
          }}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="rounded-md border border-input bg-background shadow-sm">
        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
          {activeLocations.map((location) => {
            const isSelected = selectedIds.includes(location.id);
            const inputId = `${idPrefix}-${location.id}`;
            return (
              <div
                key={location.id}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm py-1.5 px-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent/50"
                )}
              >
                <input
                  type="checkbox"
                  id={inputId}
                  checked={isSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      if (selectedIds.includes(location.id)) return;
                      onChange([...selectedIds, location.id]);
                    } else {
                      onChange(selectedIds.filter((id) => id !== location.id));
                    }
                  }}
                  className="h-4 w-4 shrink-0 rounded border border-input bg-background text-primary accent-primary cursor-pointer"
                />
                <Label htmlFor={inputId} className="text-xs font-normal cursor-pointer flex-1">
                  {location.name}
                </Label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
