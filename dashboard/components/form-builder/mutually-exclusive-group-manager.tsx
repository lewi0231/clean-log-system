"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldConfig } from "@clean-log/shared";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

interface MutuallyExclusiveGroupManagerProps {
  fields: FieldConfig[];
  onUpdateField: (
    fieldId: string,
    updates: Partial<FieldConfig>
  ) => Promise<void>;
  createdClusters: string[];
  onCreatedClustersChange: (clusters: string[]) => void;
}

interface GroupInfo {
  id: string;
  displayName: string;
  clusters: Map<string, ClusterInfo>;
}

interface ClusterInfo {
  id: string;
  displayName: string;
  fieldIds: string[];
}

// Convert group ID to display name (e.g., "yard_tracking_method" -> "Yard Tracking Method")
function getGroupDisplayName(groupId: string): string {
  return groupId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Convert cluster ID to display name
function getClusterDisplayName(clusterId: string): string {
  return clusterId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Convert display name to ID (e.g., "Yard Tracking Method" -> "yard_tracking_method")
function displayNameToId(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function MutuallyExclusiveGroupManager({
  fields,
  onUpdateField,
  createdClusters,
  onCreatedClustersChange,
}: MutuallyExclusiveGroupManagerProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newClusterName, setNewClusterName] = useState("");

  // Build groups and clusters from existing fields
  const groups = useMemo(() => {
    const groupsMap = new Map<string, GroupInfo>();

    fields.forEach((field) => {
      const groupId = field.mutually_exclusive_group;
      if (!groupId) return;

      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          id: groupId,
          displayName: getGroupDisplayName(groupId),
          clusters: new Map(),
        });
      }

      const group = groupsMap.get(groupId)!;
      const clusterId = field.group_cluster || "default";

      if (!group.clusters.has(clusterId)) {
        group.clusters.set(clusterId, {
          id: clusterId,
          displayName: getClusterDisplayName(clusterId),
          fieldIds: [],
        });
      }

      group.clusters.get(clusterId)!.fieldIds.push(field.id);
    });

    return Array.from(groupsMap.values());
  }, [fields]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCreateCluster = () => {
    if (!newClusterName.trim()) return;

    const clusterId = displayNameToId(newClusterName.trim());
    if (!createdClusters.includes(clusterId)) {
      onCreatedClustersChange([...createdClusters, clusterId]);
    }
    setNewClusterName("");
  };

  const handleDeleteCluster = async (groupId: string, clusterId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const cluster = group.clusters.get(clusterId);
    if (!cluster) return;

    // Remove all fields from this cluster
    for (const fieldId of cluster.fieldIds) {
      await onUpdateField(fieldId, {
        mutually_exclusive_group: null,
        group_cluster: null,
      });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    // Remove all fields from all clusters in this group
    for (const cluster of group.clusters.values()) {
      for (const fieldId of cluster.fieldIds) {
        await onUpdateField(fieldId, {
          mutually_exclusive_group: null,
          group_cluster: null,
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">
          Mutually Exclusive Clusters
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Create clusters (options) where only one can be selected at a time.
          Fields in the same cluster work together as a single option. Groups
          are created automatically behind the scenes.
        </p>
      </div>

      {/* Create New Cluster */}
      <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
        <Label className="text-xs font-semibold">Create New Cluster</Label>
        <p className="text-[11px] text-muted-foreground">
          Create a cluster name that can be assigned to fields. The group will
          be created automatically when you assign the first field to this
          cluster.
        </p>
        <div className="flex gap-2">
          <Input
            value={newClusterName}
            onChange={(e) => setNewClusterName(e.target.value)}
            placeholder="e.g., Simple Toggle, Detailed Breakdown"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateCluster();
              }
            }}
          />
          <Button
            onClick={handleCreateCluster}
            disabled={!newClusterName.trim()}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>
        {createdClusters.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-muted-foreground font-medium">
              Available clusters (assign in field settings):
            </p>
            <div className="flex flex-wrap gap-1">
              {createdClusters.map((cluster) => (
                <Badge key={cluster} variant="outline" className="text-xs">
                  {getClusterDisplayName(cluster)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Existing Groups */}
      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const clusters = Array.from(group.clusters.values());

            return (
              <div
                key={group.id}
                className="border rounded-lg overflow-hidden bg-card"
              >
                <div className="flex items-center gap-2 p-3 bg-muted/30">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium text-sm">
                      {group.displayName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {clusters.length} option{clusters.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-mono">
                      {group.id}
                    </Badge>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="p-3 space-y-3">
                    {/* Clusters in this group */}
                    {clusters.map((cluster) => (
                      <div
                        key={cluster.id}
                        className="flex items-center justify-between p-2 border rounded-md bg-background"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {cluster.displayName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            {cluster.id}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {cluster.fieldIds.length} field
                            {cluster.fieldIds.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            handleDeleteCluster(group.id, cluster.id)
                          }
                        >
                          <X className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    {/* Info about adding clusters */}
                    <div className="rounded-md border border-dashed p-2 bg-muted/20">
                      <p className="text-[11px] text-muted-foreground">
                        To add a new cluster (option), assign a field to a new
                        cluster name in the field settings. The cluster will
                        appear here once a field is assigned.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {groups.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">No groups created yet</p>
          <p className="text-xs mt-1">
            Create a group above, then assign fields to clusters in the field
            settings
          </p>
        </div>
      )}
    </div>
  );
}
