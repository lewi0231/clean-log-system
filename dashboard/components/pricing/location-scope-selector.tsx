"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useLocations } from "@/hooks/use-locations";
import { ChevronDown, ChevronRight, HelpCircle, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";

interface LocationScopeSelectorProps {
  selectedNodeId: string | null;
  selectedLocationId: string | null;
  onNodeChange: (nodeId: string | null) => void;
  onLocationChange: (locationId: string | null) => void;
  effectiveDate: string | null;
  onEffectiveDateChange: (date: string | null) => void;
  expirationDate: string | null;
  onExpirationDateChange: (date: string | null) => void;
}

export default function LocationScopeSelector({
  selectedNodeId,
  selectedLocationId,
  onNodeChange,
  onLocationChange,
  effectiveDate,
  onEffectiveDateChange,
  expirationDate,
  onExpirationDateChange,
}: LocationScopeSelectorProps) {
  const {
    nodes,
    loading: hierarchyLoading,
    error: hierarchyError,
  } = useLocationHierarchy();
  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
  } = useLocations();

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type.localeCompare(b.type);
    });
  }, [nodes]);

  const sortedLocations = useMemo(() => {
    return [...locations]
      .filter((loc) => loc.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations]);

  // Combined value: "default", "node:uuid", or "location:uuid"
  const combinedValue = useMemo(() => {
    if (selectedLocationId) return `location:${selectedLocationId}`;
    if (selectedNodeId) return `node:${selectedNodeId}`;
    return "default";
  }, [selectedNodeId, selectedLocationId]);

  const handleChange = (value: string) => {
    if (value === "default") {
      onNodeChange(null);
      onLocationChange(null);
    } else if (value.startsWith("node:")) {
      onNodeChange(value.replace("node:", ""));
      onLocationChange(null);
    } else if (value.startsWith("location:")) {
      onNodeChange(null);
      onLocationChange(value.replace("location:", ""));
    }
  };

  const handleEffectiveDateChange = (value: string) => {
    onEffectiveDateChange(value === "" ? null : value);
  };

  const handleExpirationDateChange = (value: string) => {
    onExpirationDateChange(value === "" ? null : value);
  };

  const isOrganizationDefault = combinedValue === "default";

  const loading = hierarchyLoading || locationsLoading;
  const error = hierarchyError || locationsError;

  const [isOpen, setIsOpen] = useState(false);

  // Get display name for selected scope
  const scopeDisplayName = useMemo(() => {
    if (selectedLocationId) {
      const location = sortedLocations.find((l) => l.id === selectedLocationId);
      return location?.name || "Selected Location";
    }
    if (selectedNodeId) {
      const node = sortedNodes.find((n) => n.id === selectedNodeId);
      return node ? `${node.name} (${node.type})` : "Selected Region";
    }
    return "Organization Default";
  }, [selectedLocationId, selectedNodeId, sortedLocations, sortedNodes]);

  // Format effective date for display
  const effectiveDateDisplay = useMemo(() => {
    if (!effectiveDate) {
      return new Date().toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return new Date(effectiveDate).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [effectiveDate]);

  return (
    <TooltipProvider>
      <Card className="border-primary/20 bg-primary/5">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <CardTitle className="text-base">Pricing Scope</CardTitle>
                    {!isOpen && (
                      <CardDescription className="text-xs mt-1">
                        Pricing applying to &quot;{scopeDisplayName}&quot;
                        {effectiveDate && (
                          <> effective as of {effectiveDateDisplay}</>
                        )}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2">
                        <p>
                          <strong>Active scope:</strong> {scopeDisplayName}
                        </p>
                        <p>
                          <strong>Applying to:</strong> Field, Option, Base, and
                          Service-Type Pricing
                        </p>
                        {effectiveDate && (
                          <p className="text-xs text-muted-foreground">
                            Viewing pricing as of {effectiveDateDisplay}. This
                            is a view-only filter. Changes you save will create
                            rules effective immediately (today).
                          </p>
                        )}
                        {!effectiveDate && (
                          <p className="text-xs text-muted-foreground">
                            Select where pricing applies: organization-wide, a
                            region/company, or a specific location. You can also
                            preview historical or future pricing by setting an
                            effective date.
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Apply Pricing To
                </Label>
                <Select
                  value={combinedValue}
                  onValueChange={handleChange}
                  disabled={loading || Boolean(error)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pricing scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Organization Default
                    </SelectItem>

                    {sortedNodes.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Regions & Companies</SelectLabel>
                        {sortedNodes.map((node) => (
                          <SelectItem key={node.id} value={`node:${node.id}`}>
                            {node.name} ({node.type})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {sortedLocations.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Specific Locations</SelectLabel>
                        {sortedLocations.map((location) => (
                          <SelectItem
                            key={location.id}
                            value={`location:${location.id}`}
                          >
                            {location.name}
                            {location.hierarchy_parent && (
                              <span className="text-muted-foreground ml-1">
                                ({location.hierarchy_parent.name})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                {error && (
                  <p className="text-xs text-destructive">
                    Failed to load: {error}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Set prices for the entire organization, a region/company, or a
                  specific location.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Effective As Of
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Leave empty to see current pricing, or set a date to
                        preview historical/future pricing. This is a view-only
                        filter.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="date"
                      value={effectiveDate || ""}
                      onChange={(event) =>
                        handleEffectiveDateChange(event.target.value)
                      }
                      placeholder="Current date"
                      className={effectiveDate ? "pr-8" : ""}
                    />
                    {effectiveDate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 p-0 hover:bg-muted rounded"
                        onClick={() => handleEffectiveDateChange("")}
                        aria-label="Clear date"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Expiration Date (Optional)
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Set a default expiration date for pricing rules created
                        at this scope. Individual rules can override this date.
                        Not available for organization default pricing.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="date"
                      value={expirationDate || ""}
                      onChange={(event) =>
                        handleExpirationDateChange(event.target.value)
                      }
                      placeholder="Never expires"
                      disabled={isOrganizationDefault}
                      className={expirationDate ? "pr-8" : ""}
                    />
                    {expirationDate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 p-0 hover:bg-muted rounded"
                        onClick={() => handleExpirationDateChange("")}
                        aria-label="Clear expiration date"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {isOrganizationDefault && (
                  <p className="text-xs text-muted-foreground">
                    Organization default pricing cannot expire
                  </p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}
