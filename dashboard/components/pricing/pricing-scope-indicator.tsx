"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useLocations } from "@/hooks/use-locations";
import { Target } from "lucide-react";
import { useMemo } from "react";

interface PricingScopeIndicatorProps {
  locationNodeId: string | null;
  locationId: string | null;
}

export function PricingScopeIndicator({
  locationNodeId,
  locationId,
}: PricingScopeIndicatorProps) {
  const { nodes } = useLocationHierarchy();
  const { locations } = useLocations();

  const scopeDisplayName = useMemo(() => {
    if (locationId) {
      const location = locations.find((loc) => loc.id === locationId);
      return location ? location.name : "Specific Location";
    }
    if (locationNodeId) {
      const node = nodes.find((n) => n.id === locationNodeId);
      return node ? `${node.name} (${node.type})` : "Region/Company";
    }
    return "Organization Default";
  }, [locationId, locationNodeId, locations, nodes]);

  return (
    <Card className="border-l-4 border-l-primary bg-muted/30">
      <CardContent className="py-3">
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Active scope:</span>
          <strong className="font-medium">{scopeDisplayName}</strong>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">Applying to:</span>
          <span className="font-medium">Field Pricing</span>
          <span className="text-muted-foreground">,</span>
          <span className="font-medium">Option Pricing</span>
          <span className="text-muted-foreground">,</span>
          <span className="font-medium">Base Pricing</span>
        </div>
      </CardContent>
    </Card>
  );
}
