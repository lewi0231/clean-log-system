"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useLocations } from "@/hooks/use-locations";
import { CalendarRange, MapPin } from "lucide-react";
import { useMemo } from "react";
import { usePricingScope } from "./pricing-scope-context";

export function PricingPreviewPanel() {
  const { locationNodeId, locationId, effectiveDate } = usePricingScope();
  const { nodes } = useLocationHierarchy();
  const { locations } = useLocations();

  const locationLabel = useMemo(() => {
    if (locationId) {
      const location = locations.find((l) => l.id === locationId);
      return location?.name || `Location ${locationId}`;
    }
    if (locationNodeId) {
      const node = nodes.find((n) => n.id === locationNodeId);
      return node?.name || `Node ${locationNodeId}`;
    }
    return "All locations";
  }, [locationId, locationNodeId, locations, nodes]);

  const effectiveDateLabel = useMemo(() => {
    if (!effectiveDate) return "Current";
    try {
      return new Date(effectiveDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return effectiveDate;
    }
  }, [effectiveDate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <div>
              <p className="text-muted-foreground">Location scope</p>
              <p className="font-medium text-foreground">{locationLabel}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <div>
              <p className="text-muted-foreground">Viewing pricing</p>
              <p className="font-medium text-foreground">
                {effectiveDateLabel}
                {effectiveDate && (
                  <span className="text-xs text-muted-foreground ml-1">
                    (view only)
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
