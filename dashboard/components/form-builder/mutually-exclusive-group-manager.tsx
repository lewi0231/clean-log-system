"use client";

import { Badge } from "@/components/ui/badge";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldConfig } from "@clean-log/shared";
import {
  Check,
  CheckCircleIcon,
  ChevronDown,
  ChevronRight,
  Edit,
  HelpCircle,
  Info,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";

interface MutuallyExclusiveGroupManagerProps {
  fields: FieldConfig[];
  onUpdateField: (
    fieldId: string,
    updates: Partial<FieldConfig>,
  ) => Promise<void>;
  createdClusters: string[];
  onCreatedClustersChange: (clusters: string[]) => void;
  defaultExclusiveGroupLabel?: string | null;
  onUpdateDefaultExclusiveGroupLabel?: (label: string) => Promise<void>;
  isInModal?: boolean;
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
  isInModal = false,
}: MutuallyExclusiveGroupManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [editingDefaultLabel, setEditingDefaultLabel] = useState(false);
  const [defaultLabelValue, setDefaultLabelValue] = useState(
    defaultExclusiveGroupLabel || "",
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fieldSelectionOpen, setFieldSelectionOpen] = useState<string | null>(
    null,
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
    setShowCreateForm(false);
  };

  const handleDeleteCluster = async (groupId: string, clusterId: string) => {
    // Try to find the cluster in groups (it might not exist if it has no fields)
    const group = groups.find((g) => g.id === groupId);
    const cluster = group?.clusters.get(clusterId);

    // If cluster exists and has fields, remove them first
    if (cluster && cluster.fieldIds.length > 0) {
      // Remove all fields from this cluster (optimistic updates handle UI immediately)
      const updatePromises = cluster.fieldIds.map((fieldId) =>
        onUpdateField(fieldId, {
          mutually_exclusive_group: null,
          group_cluster: null,
        }),
      );
      await Promise.all(updatePromises);
    }

    // Always remove cluster from createdClusters list (works for both empty and populated clusters)
    // This is the key fix - we need to remove it even if it wasn't in groups
    if (createdClusters.includes(clusterId)) {
      onCreatedClustersChange(createdClusters.filter((id) => id !== clusterId));
    }
  };

  const handleAddFieldToCluster = (clusterId: string, fieldId: string) => {
    // Close popover first to prevent layout shift
    setFieldSelectionOpen(null);
    
    // Use requestAnimationFrame to batch the update with the next paint
    // This ensures the popover closes smoothly before the field update triggers re-render
    requestAnimationFrame(() => {
      // Optimistic update happens immediately in the hook
      // Don't await to prevent UI jitter
      onUpdateField(fieldId, {
        mutually_exclusive_group: DEFAULT_EXCLUSIVE_GROUP,
        group_cluster: clusterId,
      }).catch((err) => {
        console.error("Failed to add field to option:", err);
      });
    });
  };

  // Get fields not assigned to any cluster
  const availableFields = useMemo(() => {
    return fields.filter((field) => !field.mutually_exclusive_group);
  }, [fields]);

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
    (g) => g.id === DEFAULT_EXCLUSIVE_GROUP,
  );

  // Find default exclusive group clusters for preview
  const defaultGroupClusters = useMemo(() => {
    const defaultGroup = groups.find((g) => g.id === DEFAULT_EXCLUSIVE_GROUP);
    return defaultGroup ? Array.from(defaultGroup.clusters.values()) : [];
  }, [groups]);

  // Combine clusters from fields with created clusters (so newly created options appear immediately)
  // Use a more stable comparison to prevent unnecessary recalculations
  const allClusters = useMemo(() => {
    const clusterMap = new Map<string, ClusterInfo>();

    // Add clusters from fields
    defaultGroupClusters.forEach((cluster) => {
      clusterMap.set(cluster.id, cluster);
    });

    // Add created clusters that don't have fields yet
    createdClusters.forEach((clusterId) => {
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, {
          id: clusterId,
          displayName: getClusterDisplayName(clusterId),
          fieldIds: [],
        });
      }
    });

    return Array.from(clusterMap.values());
  }, [
    // Use JSON.stringify for stable comparison of cluster arrays
    // This prevents recalculation when array reference changes but content is the same
    JSON.stringify(
      defaultGroupClusters.map((c) => ({
        id: c.id,
        fieldCount: c.fieldIds.length,
      })),
    ),
    // Use joined string for createdClusters to avoid array reference issues
    createdClusters.join(","),
  ]);

  // Calculate total options count
  const totalOptionsCount = allClusters.length;

  // If in modal, render single column layout with mobile preview moved
  if (isInModal) {
    return (
      <div className="space-y-6 py-4">
        {/* Configuration Section */}
        <div className="space-y-6">
          {/* Dropdown Label Section */}
          {hasDefaultExclusiveGroup && onUpdateDefaultExclusiveGroupLabel && (
            <Card>
              <CardContent className="py-2 px-4">
                <Label className=" font-semibold mb-2 flex items-center gap-2">
                  {/* <Info className="w-4 h-4 text-muted-foreground" /> */}
                  Dropdown Label
                </Label>
                <p className="text-xs text-muted-foreground mb-4">
                  This text appears as the prompt for the question in the mobile
                  app.
                </p>
                <div className="relative">
                  {editingDefaultLabel ? (
                    <div className="flex gap-2">
                      <Input
                        value={defaultLabelValue}
                        onChange={(e) => setDefaultLabelValue(e.target.value)}
                        placeholder="e.g., Select tracking method, Choose an option"
                        className="flex-1"
                        autoFocus
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
                    <>
                      <Input
                        value={defaultExclusiveGroupLabel || "Select an option"}
                        readOnly
                        className="pr-16"
                      />
                      <Button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-medium text-sm hover:underline cursor-pointer"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingDefaultLabel(true)}
                      >
                        <Edit /> Edit
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Options Section */}
          <Card>
            <CardHeader className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="bg-linear-to-brary" />

                <CardTitle className="text-base">Available Options</CardTitle>
              </div>
              {totalOptionsCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold"
                >
                  {totalOptionsCount} Total
                </Badge>
              )}
            </CardHeader>
            <CardContent className="px-4 py-2 space-y-4">
              {totalOptionsCount > 0 && (
                <p className="text-sm text-muted-foreground mb-4 italic">
                  Workers can only select one of these options at a time.
                </p>
              )}

              {/* Empty State */}
              {totalOptionsCount === 0 && createdClusters.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                  {/* Illustration */}
                  <div className="w-64 h-48 bg-linear-to-br from-indigo-100 to-slate-100 dark:from-indigo-900/20 dark:to-slate-900 rounded-3xl mb-8 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 dark:opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>

                    <div className="relative flex flex-col items-center">
                      <div className="w-32 h-20 bg-white dark:bg-slate-700 rounded-lg shadow-lg flex flex-col p-3 space-y-2 transform -rotate-3 border border-slate-100 dark:border-slate-600">
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-600 rounded"></div>
                        <div className="w-2/3 h-2 bg-slate-100 dark:bg-slate-600 rounded"></div>
                      </div>
                      <div className="w-32 h-20 bg-white dark:bg-slate-700 rounded-lg shadow-xl flex flex-col p-3 space-y-2 transform rotate-6 -mt-10 border border-slate-100 dark:border-slate-600">
                        <div className="w-full h-2 bg-primary/20 rounded"></div>
                        <div className="w-2/3 h-2 bg-primary/20 rounded"></div>
                        <div className="self-end mt-auto">
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    No options created yet
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Define the choices workers can select from. Each option can
                    be assigned specific fields to streamline their workflow.
                  </p>
                  {!showCreateForm ? (
                    <Button
                      onClick={() => setShowCreateForm(true)}
                      className="bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-8 rounded-full flex items-center space-x-2 shadow-lg shadow-primary/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Option</span>
                    </Button>
                  ) : (
                    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="bg-muted/50 p-4 rounded-xl border space-y-4">
                        <div className="text-left">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                            Option Name
                          </Label>
                          <Input
                            value={newClusterName}
                            onChange={(e) => setNewClusterName(e.target.value)}
                            placeholder="e.g., Simple Toggle, Warehouse, Detailed..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCreateCluster();
                              } else if (e.key === "Escape") {
                                setShowCreateForm(false);
                                setNewClusterName("");
                              }
                            }}
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setShowCreateForm(false);
                              setNewClusterName("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={handleCreateCluster}
                            disabled={!newClusterName.trim()}
                          >
                            Save Option
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Populated State - Options List */}
              {totalOptionsCount > 0 && (
                <div className="space-y-4">
                  {allClusters.map((cluster) => {
                    const clusterFields = cluster.fieldIds
                      .map((fieldId) => fields.find((f) => f.id === fieldId))
                      .filter((f): f is FieldConfig => f !== undefined);

                    // Determine if this is the "selected" option (first one for now, or could be based on some state)
                    const isSelected = false; // Could be based on some selection state

                    return (
                      <div
                        key={cluster.id}
                        className="group border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-primary/50 transition-all bg-white dark:bg-slate-900/50 flex items-start justify-between"
                      >
                        <div className="flex gap-4 flex-1">
                          <div className="mt-1">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? "border-primary"
                                  : "border-slate-300 dark:border-slate-600 group-hover:border-primary"
                              }`}
                            >
                              {/* Show dot if selected, or on hover if not selected */}
                              {isSelected ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold">
                                {cluster.displayName}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded"
                              >
                                {cluster.fieldIds.length}{" "}
                                {cluster.fieldIds.length === 1
                                  ? "Field"
                                  : "Fields Assigned"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {clusterFields.map((field) => (
                                <Badge
                                  key={field.id}
                                  variant="outline"
                                  className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md flex items-center gap-1.5 group"
                                >
                                  <span>{field.label}</span>
                                  <button
                                    onClick={() => {
                                      // Optimistic update happens immediately in the hook
                                      // Don't await to prevent UI jitter
                                      onUpdateField(field.id, {
                                        mutually_exclusive_group: null,
                                        group_cluster: null,
                                      }).catch((err) => {
                                        console.error(
                                          "Failed to remove field from option:",
                                          err,
                                        );
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5 -mr-1"
                                    aria-label={`Remove ${field.label} from option`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Add Field Button */}
                          {availableFields.length > 0 && (
                            <Popover
                              open={fieldSelectionOpen === cluster.id}
                              onOpenChange={(open) =>
                                setFieldSelectionOpen(open ? cluster.id : null)
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-primary transition-colors"
                                  onClick={() =>
                                    setFieldSelectionOpen(cluster.id)
                                  }
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64" align="end">
                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold">
                                    Add Field to Option
                                  </Label>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Select a field to add to this option
                                  </p>
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {availableFields.map((field) => (
                                      <Button
                                        key={field.id}
                                        variant="ghost"
                                        className="w-full justify-start text-sm h-auto py-2"
                                        onClick={() =>
                                          handleAddFieldToCluster(
                                            cluster.id,
                                            field.id,
                                          )
                                        }
                                      >
                                        {field.label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 transition-colors"
                            onClick={() =>
                              handleDeleteCluster(
                                DEFAULT_EXCLUSIVE_GROUP,
                                cluster.id,
                              )
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add New Option Button */}
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all font-medium"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <Plus className="w-5 h-5" />
                    Add New Option
                  </Button>
                </div>
              )}

              {/* Create Form (shown when Add New Option is clicked in populated state) */}
              {showCreateForm && totalOptionsCount > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="text-left">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      Option Name
                    </Label>
                    <Input
                      value={newClusterName}
                      onChange={(e) => setNewClusterName(e.target.value)}
                      placeholder="e.g., Simple Toggle, Warehouse, Detailed..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateCluster();
                        } else if (e.key === "Escape") {
                          setShowCreateForm(false);
                          setNewClusterName("");
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewClusterName("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleCreateCluster}
                      disabled={!newClusterName.trim()}
                    >
                      Save Option
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              To add a new option, create it above, then assign fields to it in
              their individual settings. The option will appear active once
              fields are linked.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Original Card layout (backward compatibility)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose One Options</CardTitle>
        <CardDescription>
          Create options where workers can only select one at a time. For
          example, &quot;Simple Toggle&quot; vs &quot;Detailed Breakdown&quot; -
          workers choose either one, not both.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create New Option - Prominent */}
        <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
          <div>
            <Label className="text-sm font-semibold">Create New Option</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Give your option a name, then assign fields to it in their
              settings.
            </p>
          </div>
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
              Create Option
            </Button>
          </div>
          {createdClusters.length > 0 && (
            <div className="mt-2 space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground font-medium">
                Available options - assign to fields in their settings:
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

        {/* How It Works - Collapsible */}
        <Collapsible open={showHowItWorks} onOpenChange={setShowHowItWorks}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between text-sm"
              size="sm"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                <span>How it works?</span>
              </div>
              {showHowItWorks ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2 pl-4 border-l-2 border-muted bg-muted/20 rounded-r-md">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Example:</p>
                <div className="rounded-lg border bg-background p-3 space-y-2 text-sm">
                  <div className="font-medium">Car Wash Service</div>
                  <div className="space-y-1 pl-4 border-l-2 border-primary/30">
                    <div>
                      <div className="font-medium text-primary">
                        Option 1: &quot;Simple Toggle&quot;
                      </div>
                      <div className="text-xs text-muted-foreground pl-2">
                        Fields: Washed (yes/no)
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-primary">
                        Option 2: &quot;Detailed Breakdown&quot;
                      </div>
                      <div className="text-xs text-muted-foreground pl-2">
                        Fields: Washed, Soaped, Rinsed, Dried
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-dashed p-3 bg-background">
                <p className="text-xs text-muted-foreground">
                  <strong>In the mobile app:</strong> Workers see a dropdown
                  asking them to choose one option. Once selected, only the
                  fields for that option appear.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium">Steps:</p>
                <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
                  <li>Create an option name above</li>
                  <li>
                    Go to a field&apos;s settings and assign it to that option
                  </li>
                  <li>
                    Repeat for other fields that belong to the same option
                  </li>
                  <li>Create additional options as needed</li>
                </ol>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Dropdown Label Editor - Simplified */}
        {hasDefaultExclusiveGroup && onUpdateDefaultExclusiveGroupLabel && (
          <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
            <Label className="text-sm font-semibold">Dropdown Label</Label>
            <p className="text-xs text-muted-foreground">
              Customize the question text that appears in the mobile app
              dropdown. For example: &quot;Select tracking method&quot; or
              &quot;Choose an option&quot;.
            </p>
            {editingDefaultLabel ? (
              <div className="flex gap-2">
                <Input
                  value={defaultLabelValue}
                  onChange={(e) => setDefaultLabelValue(e.target.value)}
                  placeholder="e.g., Select tracking method, Choose an option"
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
                  {defaultExclusiveGroupLabel || "Select an option"}
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

        {/* Your Options - Only show if options exist */}
        {groups.length > 0 && (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Your Options</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Options you&apos;ve created and their assigned fields
              </p>
            </div>
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
                            {clusters.length} option
                            {clusters.length !== 1 ? "s" : ""} created
                          </span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="p-3 space-y-3">
                          {/* Clusters in this group */}
                          {clusters.map((cluster) => {
                            const clusterFields = cluster.fieldIds
                              .map((fieldId) =>
                                fields.find((f) => f.id === fieldId),
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

                          {/* Info about adding options */}
                          <div className="rounded-md border border-dashed p-2 bg-muted/20">
                            <p className="text-xs text-muted-foreground">
                              To add a new option, create it above, then assign
                              fields to it in their settings. The option will
                              appear here once fields are assigned.
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
                        <p className="text-xs text-muted-foreground">
                          Preview of how this appears in the mobile app
                        </p>
                        <div className="rounded-lg border bg-muted/50 p-4">
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs font-medium text-foreground mb-1.5 block">
                                {defaultExclusiveGroupLabel ||
                                  "Select an option"}
                              </Label>
                              <div className="border border-border rounded-lg overflow-hidden bg-card">
                                <MobilePreviewSelect
                                  clusters={defaultGroupClusters.map(
                                    (cluster) => ({
                                      id: cluster.id,
                                      displayName: cluster.displayName,
                                      fieldLabels: cluster.fieldIds
                                        .map((fieldId) =>
                                          fields.find((f) => f.id === fieldId),
                                        )
                                        .filter(
                                          (f): f is FieldConfig =>
                                            f !== undefined,
                                        )
                                        .map((f) => f.label),
                                    }),
                                  )}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Edit the label above to customize how it appears
                              in the mobile app dropdown.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {groups.length === 0 && createdClusters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <p className="text-sm font-medium">No options created yet</p>
            <p className="text-xs mt-2">
              Create your first option above to get started. Options let workers
              choose between different ways to track the same thing.
            </p>
            <div className="mt-4 text-left max-w-md mx-auto space-y-1">
              <p className="text-xs font-medium">Example:</p>
              <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                <li>• &quot;Simple&quot; - quick yes/no toggle</li>
                <li>
                  • &quot;Detailed&quot; - multiple checkboxes for breakdown
                </li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
