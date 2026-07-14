"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useLocations } from "@/hooks/use-locations";
import { Calendar, Eye, MapPin } from "lucide-react";
import { useMemo } from "react";

interface PricingContextBarProps {
  effectiveDate: string | null;
  onEffectiveDateChange: (date: string | null) => void;
  previewLocationId: string | null;
  previewLocationHierarchyId: string | null;
  onPreviewChange: (locationId: string | null, hierarchyId: string | null) => void;
  onAdvancedScopeClick: () => void;
  hasUnsavedChanges?: boolean;
  onBlockedPreviewChange?: () => void;
}

export function PricingContextBar({
  effectiveDate,
  onEffectiveDateChange,
  previewLocationId,
  previewLocationHierarchyId,
  onPreviewChange,
  onAdvancedScopeClick,
  hasUnsavedChanges = false,
  onBlockedPreviewChange,
}: PricingContextBarProps) {
  const { locations } = useLocations();
  const { nodes } = useLocationHierarchy();

  const sortedLocations = useMemo(
    () => [...locations].filter((loc) => loc.active).sort((a, b) => a.name.localeCompare(b.name)),
    [locations]
  );

  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type.localeCompare(b.type);
      }),
    [nodes]
  );

  const combinedPreviewValue = useMemo(() => {
    if (previewLocationId) return `location:${previewLocationId}`;
    if (previewLocationHierarchyId) return `node:${previewLocationHierarchyId}`;
    return "all";
  }, [previewLocationId, previewLocationHierarchyId]);

  const handlePreviewSelect = (value: string) => {
    if (hasUnsavedChanges) {
      onBlockedPreviewChange?.();
      return;
    }
    if (value === "all") {
      onPreviewChange(null, null);
    } else if (value.startsWith("node:")) {
      onPreviewChange(null, value.replace("node:", ""));
    } else if (value.startsWith("location:")) {
      onPreviewChange(value.replace("location:", ""), null);
    }
  };

  const handleDateChange = (value: string) => {
    if (hasUnsavedChanges) {
      onBlockedPreviewChange?.();
      return;
    }
    onEffectiveDateChange(value === "" ? null : value);
  };

  return (
    <Card className="border-l-4 border-l-primary bg-muted/30">
      <CardContent className="py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="space-y-1 min-w-[10rem]">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">View as of</Label>
                <ContextualHelp label="View as of" className="h-6 w-6">
                  <p>
                    Show prices that apply on this date. Saving always creates rules effective
                    today.
                  </p>
                </ContextualHelp>
              </div>
              <Input
                type="date"
                value={effectiveDate || ""}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[12rem]">
              <div className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Preview for yard</Label>
                <ContextualHelp label="Preview for yard" className="h-6 w-6">
                  <p>
                    See what this yard would use. Change overrides on each price below — main inputs
                    update All yards default.
                  </p>
                </ContextualHelp>
              </div>
              <Select value={combinedPreviewValue} onValueChange={handlePreviewSelect}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All yards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All yards</SelectItem>
                  {sortedNodes.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Regions & companies</SelectLabel>
                      {sortedNodes.map((node) => (
                        <SelectItem key={node.id} value={`node:${node.id}`}>
                          {node.name} ({node.type})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {sortedLocations.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Yards & locations</SelectLabel>
                      {sortedLocations.map((location) => (
                        <SelectItem key={location.id} value={`location:${location.id}`}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-8 px-0 text-xs gap-1 self-start lg:self-auto"
            onClick={onAdvancedScopeClick}
          >
            <MapPin className="h-3 w-3" />
            Advanced scope & bulk tools
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
