"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useMemo } from "react";

interface LocationScopeSelectorProps {
  selectedNodeId: string | null;
  onNodeChange: (nodeId: string | null) => void;
  effectiveDate: string | null;
  onEffectiveDateChange: (date: string | null) => void;
}

export default function LocationScopeSelector({
  selectedNodeId,
  onNodeChange,
  effectiveDate,
  onEffectiveDateChange,
}: LocationScopeSelectorProps) {
  const { nodes, loading, error } = useLocationHierarchy();

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type.localeCompare(b.type);
    });
  }, [nodes]);

  const handleNodeChange = (value: string) => {
    if (value === "default") {
      onNodeChange(null);
    } else {
      onNodeChange(value);
    }
  };

  const handleEffectiveDateChange = (value: string) => {
    onEffectiveDateChange(value === "" ? null : value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pricing Scope</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Location Hierarchy
          </label>
          <Select
            value={selectedNodeId || "default"}
            onValueChange={handleNodeChange}
            disabled={loading || Boolean(error)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Organization Default</SelectItem>
              {sortedNodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {node.name} ({node.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && (
            <p className="text-xs text-destructive">
              Failed to load hierarchy: {error}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Effective As Of
          </label>
          <Input
            type="date"
            value={effectiveDate || ""}
            onChange={(event) => handleEffectiveDateChange(event.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
