"use client";

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
import { FieldConfig } from "@clean-log/shared";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";

interface MutuallyExclusiveGroupManagerProps {
  fields: FieldConfig[];
  onUpdateField: (
    fieldId: string,
    updates: Partial<FieldConfig>
  ) => Promise<void>;
  createdClusters: string[];
  onCreatedClustersChange: (clusters: string[]) => void;
  defaultExclusiveGroupLabel?: string | null;
  onUpdateDefaultExclusiveGroupLabel?: (label: string) => Promise<void>;
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

// Single implicit mutually exclusive group for all clusters
const DEFAULT_EXCLUSIVE_GROUP = "default_exclusive_group";

export function MutuallyExclusiveGroupManager({
  fields,
  onUpdateField,
  createdClusters,
  onCreatedClustersChange,
  defaultExclusiveGroupLabel,
  onUpdateDefaultExclusiveGroupLabel,
}: MutuallyExclusiveGroupManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [editingDefaultLabel, setEditingDefaultLabel] = useState(false);
  const [defaultLabelValue, setDefaultLabelValue] = useState(
    defaultExclusiveGroupLabel || ""
  );

  // Build groups and clusters from existing fields
  const groups = useMemo(() => {
    const groupsMap = new Map<string, GroupInfo>();

    fields.forEach((field) => {
      const groupId = field.mutually_exclusive_group;
      if (!groupId) return;

      if (!groupsMap.has(groupId)) {
        // Use custom label for default_exclusive_group if available
        const displayName =
          groupId === DEFAULT_EXCLUSIVE_GROUP && defaultExclusiveGroupLabel
            ? defaultExclusiveGroupLabel
            : getGroupDisplayName(groupId);
        groupsMap.set(groupId, {
          id: groupId,
          displayName,
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
  }, [fields, defaultExclusiveGroupLabel]);

  const toggleGroup = () => {
    setIsExpanded((prev) => !prev);
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

  const handleSaveDefaultLabel = async () => {
    if (onUpdateDefaultExclusiveGroupLabel && defaultLabelValue.trim()) {
      await onUpdateDefaultExclusiveGroupLabel(defaultLabelValue.trim());
      setEditingDefaultLabel(false);
    }
  };

  const handleCancelDefaultLabel = () => {
    setDefaultLabelValue(defaultExclusiveGroupLabel || "");
    setEditingDefaultLabel(false);
  };

  // Update local state when prop changes
  React.useEffect(() => {
    setDefaultLabelValue(defaultExclusiveGroupLabel || "");
  }, [defaultExclusiveGroupLabel]);

  const hasDefaultExclusiveGroup = groups.some(
    (g) => g.id === DEFAULT_EXCLUSIVE_GROUP
  );

  // Find default exclusive group for preview
  const defaultGroup = groups.find((g) => g.id === DEFAULT_EXCLUSIVE_GROUP);
  const defaultGroupClusters = defaultGroup
    ? Array.from(defaultGroup.clusters.values())
    : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-4">
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

        {/* Default Exclusive Group Label Editor */}
        {hasDefaultExclusiveGroup && onUpdateDefaultExclusiveGroupLabel && (
          <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
            <Label className="text-xs font-semibold">
              Default Exclusive Group Label
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Customize the label used for the default exclusive group in the
              mobile app dropdown. This label will appear as the title of the
              select option.
            </p>
            {editingDefaultLabel ? (
              <div className="flex gap-2">
                <Input
                  value={defaultLabelValue}
                  onChange={(e) => setDefaultLabelValue(e.target.value)}
                  placeholder="e.g., Select Option, Choose Method"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveDefaultLabel();
                    } else if (e.key === "Escape") {
                      handleCancelDefaultLabel();
                    }
                  }}
                />
                <Button onClick={handleSaveDefaultLabel} size="sm">
                  Save
                </Button>
                <Button
                  onClick={handleCancelDefaultLabel}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 bg-background rounded-md border">
                <span className="text-sm">
                  {defaultExclusiveGroupLabel || "Default Exclusive Group"}
                </span>
                <Button
                  onClick={() => setEditingDefaultLabel(true)}
                  variant="ghost"
                  size="sm"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Existing Groups */}
        {groups.length > 0 && (
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0 space-y-2">
              {groups.map((group) => {
                const clusters = Array.from(group.clusters.values());

                return (
                  <div
                    key={group.id}
                    className="border rounded-lg overflow-hidden bg-card"
                  >
                    <div className="flex items-center gap-2 p-3 bg-muted/30">
                      <button
                        onClick={toggleGroup}
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
                          {clusters.length} option
                          {clusters.length !== 1 ? "s" : ""}
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
                        {clusters.map((cluster) => {
                          const clusterFields = cluster.fieldIds
                            .map((fieldId) =>
                              fields.find((f) => f.id === fieldId)
                            )
                            .filter((f): f is FieldConfig => f !== undefined);

                          return (
                            <div
                              key={cluster.id}
                              className="border rounded-md bg-background overflow-hidden"
                            >
                              <div className="flex items-center justify-between p-2">
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
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
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
                              {/* Field names list */}
                              {clusterFields.length > 0 && (
                                <div className="px-2 pb-2 pl-6">
                                  <ul className="space-y-1">
                                    {clusterFields.map((field) => (
                                      <li
                                        key={field.id}
                                        className="text-xs text-muted-foreground"
                                      >
                                        • {field.label}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Info about adding clusters */}
                        <div className="rounded-md border border-dashed p-2 bg-muted/20">
                          <p className="text-[11px] text-muted-foreground">
                            To add a new cluster (option), assign a field to a
                            new cluster name in the field settings. The cluster
                            will appear here once a field is assigned.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Preview - Show when group is expanded */}
            {isExpanded &&
              hasDefaultExclusiveGroup &&
              defaultGroupClusters.length > 0 && (
                <div className="hidden lg:block w-[380px] shrink-0">
                  <div className="sticky top-4">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-xs font-semibold">
                          Mobile App Preview
                        </Label>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        How the dropdown will appear in the mobile app
                      </p>
                      <div className="rounded-lg border bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                              {defaultExclusiveGroupLabel ||
                                getGroupDisplayName(DEFAULT_EXCLUSIVE_GROUP)}
                            </Label>
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
                              <MobilePreviewSelect
                                clusters={defaultGroupClusters.map(
                                  (cluster) => ({
                                    id: cluster.id,
                                    displayName: cluster.displayName,
                                    fieldLabels: cluster.fieldIds
                                      .map((fieldId) =>
                                        fields.find((f) => f.id === fieldId)
                                      )
                                      .filter(
                                        (f): f is FieldConfig => f !== undefined
                                      )
                                      .map((f) => f.label),
                                  })
                                )}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Edit the label above to customize how it appears in
                            the mobile app dropdown.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
    </div>
  );
}

// Mobile Preview Select Component
function MobilePreviewSelect({
  clusters,
}: {
  clusters: Array<{ id: string; displayName: string; fieldLabels: string[] }>;
}) {
  const [value, setValue] = useState<string>("");

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="h-12 border-0 bg-transparent">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {clusters.map((cluster) => (
          <SelectItem key={cluster.id} value={cluster.id}>
            {cluster.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
