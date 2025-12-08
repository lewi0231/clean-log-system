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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import type { LocationHierarchyNode } from "@/lib/types";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Globe,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type NodeType = "company" | "region";

interface HierarchyTreeNode extends LocationHierarchyNode {
  children: HierarchyTreeNode[];
}

const typeIcons: Record<NodeType, React.ReactNode> = {
  company: <Building2 className="h-4 w-4 text-blue-600" />,
  region: <Globe className="h-4 w-4 text-green-600" />,
};

const typeLabels: Record<NodeType, string> = {
  company: "Company",
  region: "Region",
};

function buildTree(nodes: LocationHierarchyNode[]): HierarchyTreeNode[] {
  const nodeMap = new Map<string, HierarchyTreeNode>();
  const roots: HierarchyTreeNode[] = [];

  // First pass: create all nodes with empty children
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Second pass: build the tree structure
  nodes.forEach((node) => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  });

  // Sort children by name
  const sortChildren = (nodes: HierarchyTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

interface TreeNodeProps {
  node: HierarchyTreeNode;
  onEdit: (node: LocationHierarchyNode) => void;
  onDelete: (node: LocationHierarchyNode) => void;
  onAddChild: (parentId: string, parentType: NodeType) => void;
  level: number;
}

function TreeNode({
  node,
  onEdit,
  onDelete,
  onAddChild,
  level,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const canAddChild = node.type === "company"; // Only companies can have region children

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 rounded-md py-1.5 px-2 hover:bg-muted/50 group"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {typeIcons[node.type as NodeType]}

        <span className="flex-1 font-medium text-sm">{node.name}</span>

        <Badge variant="secondary" className="text-xs">
          {typeLabels[node.type as NodeType]}
        </Badge>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {canAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAddChild(node.id, node.type as NodeType)}
              title="Add child"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(node)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(node)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AutoSendConfig {
  enabled: boolean;
  period: "daily" | "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  time?: string;
}

interface NodeFormData {
  name: string;
  type: NodeType;
  parent_id: string | null;
  autoSend: AutoSendConfig;
}

export default function LocationHierarchyManager() {
  const { nodes, loading, error, createNode, updateNode, deleteNode } =
    useLocationHierarchy();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationHierarchyNode | null>(
    null
  );
  const [formData, setFormData] = useState<NodeFormData>({
    name: "",
    type: "company",
    parent_id: null,
    autoSend: {
      enabled: false,
      period: "daily",
      time: "09:00",
    },
  });
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] =
    useState<LocationHierarchyNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const handleOpenCreate = (parentId?: string, parentType?: NodeType) => {
    // Only companies can have children (regions)
    let defaultType: NodeType = "company";
    if (parentType === "company") defaultType = "region";

    setEditingNode(null);
    setFormData({
      name: "",
      type: defaultType,
      parent_id: parentId || null,
      autoSend: {
        enabled: false,
        period: "daily",
        time: "09:00",
      },
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (node: LocationHierarchyNode) => {
    setEditingNode(node);

    // Extract auto-send config from metadata
    const metadata = node.metadata || {};
    const autoSendData = metadata.auto_send_invoices as
      | Partial<AutoSendConfig>
      | undefined;

    setFormData({
      name: node.name,
      type: node.type as NodeType,
      parent_id: node.parent_id,
      autoSend: {
        enabled: autoSendData?.enabled || false,
        period: autoSendData?.period || "daily",
        day_of_week: autoSendData?.day_of_week,
        day_of_month: autoSendData?.day_of_month,
        time: autoSendData?.time || "09:00",
      },
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (node: LocationHierarchyNode) => {
    setNodeToDelete(node);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    try {
      setSaving(true);

      // Build metadata with auto-send config
      const metadata: Record<string, unknown> = {};
      if (formData.autoSend.enabled) {
        metadata.auto_send_invoices = {
          enabled: true,
          period: formData.autoSend.period,
          ...(formData.autoSend.day_of_week !== undefined && {
            day_of_week: formData.autoSend.day_of_week,
          }),
          ...(formData.autoSend.day_of_month !== undefined && {
            day_of_month: formData.autoSend.day_of_month,
          }),
          time: formData.autoSend.time || "09:00",
        };
      } else {
        // If disabled, remove from metadata (or set to disabled)
        metadata.auto_send_invoices = { enabled: false };
      }

      if (editingNode) {
        // Preserve existing metadata and merge auto-send config
        const existingMetadata = editingNode.metadata || {};
        const updatedMetadata = {
          ...existingMetadata,
          ...metadata,
        };

        await updateNode({
          id: editingNode.id,
          name: formData.name.trim(),
          metadata: updatedMetadata,
        });
      } else {
        await createNode({
          name: formData.name.trim(),
          type: formData.type,
          parent_id: formData.parent_id,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }

      setDialogOpen(false);
      setEditingNode(null);
      setFormData({
        name: "",
        type: "company",
        parent_id: null,
        autoSend: {
          enabled: false,
          period: "daily",
          time: "09:00",
        },
      });
    } catch (err) {
      console.error("Failed to save node:", err);
      alert(
        err instanceof Error ? err.message : "Failed to save location hierarchy"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!nodeToDelete) return;

    try {
      setDeleting(true);
      await deleteNode(nodeToDelete.id);
      setDeleteDialogOpen(false);
      setNodeToDelete(null);
    } catch (err) {
      console.error("Failed to delete node:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to delete location hierarchy"
      );
    } finally {
      setDeleting(false);
    }
  };

  // Get available parent options based on selected type
  const parentOptions = useMemo(() => {
    if (formData.type === "company") return [];
    if (formData.type === "region") {
      return nodes.filter((n) => n.type === "company");
    }
    return [];
  }, [nodes, formData.type]);

  if (loading) {
    return <LoadingState message="Loading location hierarchy..." />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Location Hierarchy</CardTitle>
              <CardDescription>
                Organize your business into companies and regions for pricing
                inheritance. Locations assigned to a region will inherit its
                pricing rules.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Node
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          {tree.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                No location hierarchy defined yet. Create your first node to get
                started.
              </p>
              <Button variant="outline" onClick={() => handleOpenCreate()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Company
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  onEdit={handleOpenEdit}
                  onDelete={handleOpenDelete}
                  onAddChild={handleOpenCreate}
                  level={0}
                />
              ))}
            </div>
          )}

          <Collapsible className="mt-4">
            <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ChevronRight className="h-4 w-4" />
              How does location hierarchy work?
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Company:</strong> Top-level organization unit. Use this
                for different business entities or brands.
              </p>
              <p>
                <strong>Region:</strong> Geographic or logical grouping under a
                company. Use for states, territories, or service areas.
              </p>
              <p className="pt-2">
                <strong>How it works:</strong> Create companies and regions
                here, then assign customer locations (in the Customer Locations
                tab) to a region. Locations inherit pricing rules from their
                assigned region and its parent company.
              </p>
              <p className="pt-2">
                Set regional pricing in the Pricing page by selecting a node in
                &quot;Pricing Scope&quot;.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingNode ? "Edit Location Node" : "Add Location Node"}
            </DialogTitle>
            <DialogDescription>
              {editingNode
                ? "Update the name of this location node."
                : "Create a new node in your location hierarchy."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter node name"
              />
            </div>

            {!editingNode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        type: value as NodeType,
                        parent_id: value === "company" ? null : prev.parent_id,
                      }))
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          Company
                        </div>
                      </SelectItem>
                      <SelectItem value="region">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-green-600" />
                          Region
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "region" && (
                  <div className="space-y-2">
                    <Label htmlFor="parent">Parent Company</Label>
                    <Select
                      value={formData.parent_id || ""}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          parent_id: value || null,
                        }))
                      }
                    >
                      <SelectTrigger id="parent">
                        <SelectValue placeholder="Select parent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parentOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parentOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Create a company first.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Auto-Send Invoice Configuration */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-send-enabled">Auto-Send Invoices</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send draft invoices for locations in this
                    hierarchy node based on a schedule
                  </p>
                </div>
                <Switch
                  id="auto-send-enabled"
                  checked={formData.autoSend.enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      autoSend: { ...prev.autoSend, enabled: checked },
                    }))
                  }
                />
              </div>

              {formData.autoSend.enabled && (
                <div className="space-y-4 pl-6 border-l-2">
                  <div className="space-y-2">
                    <Label htmlFor="auto-send-period">Send Frequency</Label>
                    <Select
                      value={formData.autoSend.period}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          autoSend: {
                            ...prev.autoSend,
                            period: value as "daily" | "weekly" | "monthly",
                          },
                        }))
                      }
                    >
                      <SelectTrigger id="auto-send-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.autoSend.period === "weekly" && (
                    <div className="space-y-2">
                      <Label htmlFor="auto-send-day-of-week">Day of Week</Label>
                      <Select
                        value={String(formData.autoSend.day_of_week ?? 1)}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            autoSend: {
                              ...prev.autoSend,
                              day_of_week: Number(value),
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="auto-send-day-of-week">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.autoSend.period === "monthly" && (
                    <div className="space-y-2">
                      <Label htmlFor="auto-send-day-of-month">
                        Day of Month
                      </Label>
                      <Input
                        id="auto-send-day-of-month"
                        type="number"
                        min="1"
                        max="31"
                        value={formData.autoSend.day_of_month ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            autoSend: {
                              ...prev.autoSend,
                              day_of_month:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            },
                          }))
                        }
                        placeholder="1-31"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="auto-send-time">Time</Label>
                    <Input
                      id="auto-send-time"
                      type="time"
                      value={formData.autoSend.time || "09:00"}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          autoSend: {
                            ...prev.autoSend,
                            time: e.target.value,
                          },
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Time of day to send invoices (24-hour format)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !formData.name.trim() ||
                (formData.type !== "company" && !formData.parent_id)
              }
            >
              {saving ? "Saving..." : editingNode ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{nodeToDelete?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
