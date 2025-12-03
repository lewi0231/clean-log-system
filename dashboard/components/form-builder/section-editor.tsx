"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldConfig,
  FieldType,
  FormSectionWithFields,
} from "@clean-log/shared";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderPlus,
  GripVertical,
  Hash,
  Layers,
  List,
  Mail,
  Pencil,
  Phone,
  Settings,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConditionalLogicEditor } from "./conditional-logic-editor";

interface SectionEditorProps {
  sections: FormSectionWithFields[];
  fields: FieldConfig[];
  onAddSection: (
    section: Omit<
      FormSectionWithFields,
      "id" | "organization_id" | "created_at" | "updated_at"
    >
  ) => void;
  onUpdateSection: (
    sectionId: string,
    updates: Partial<FormSectionWithFields>
  ) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (sectionIds: string[]) => void;
  draggedFieldId?: string | null;
  onDropFieldToSection?: (sectionId: string, fieldId: string) => void;
  onRemoveFieldFromSection?: (fieldId: string) => void;
  onUpdateField?: (
    fieldId: string,
    updates: Partial<FieldConfig>
  ) => void | Promise<void>;
  createdClusters?: string[];
}

interface SectionFormData {
  title: string;
  description: string;
  collapsed_by_default: boolean;
}

// Field type definitions with icons
const FIELD_TYPES: {
  type: FieldType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { type: "text", icon: Type, label: "Text" },
  { type: "number", icon: Hash, label: "Number" },
  { type: "email", icon: Mail, label: "Email" },
  { type: "phone", icon: Phone, label: "Phone" },
  { type: "select", icon: List, label: "Select" },
  { type: "textarea", icon: AlignLeft, label: "Text Area" },
  { type: "date", icon: Calendar, label: "Date" },
  { type: "time", icon: Clock, label: "Time" },
  { type: "boolean", icon: CheckSquare, label: "Checkbox" },
  { type: "grouped_breakdown", icon: Layers, label: "Grouped" },
];

// Single implicit mutually exclusive group for all clusters
const DEFAULT_EXCLUSIVE_GROUP = "default_exclusive_group";

export function SectionEditor({
  sections,
  fields,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onReorderSections,
  draggedFieldId,
  onDropFieldToSection,
  onRemoveFieldFromSection,
  onUpdateField,
  createdClusters = [],
}: SectionEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] =
    useState<FormSectionWithFields | null>(null);
  const [formData, setFormData] = useState<SectionFormData>({
    title: "",
    description: "",
    collapsed_by_default: false,
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>(() =>
    sections.map((s) => s.id)
  );
  const [advancedSectionsOpen, setAdvancedSectionsOpen] = useState<
    Map<string, boolean>
  >(new Map());
  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields]
  );

  // Handle options update for select fields
  const handleOptionsChange = async (
    fieldId: string,
    optionsString: string
  ) => {
    if (!onUpdateField) return;
    const options = optionsString
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    await onUpdateField(fieldId, {
      options: options.length > 0 ? options : null,
    });
  };

  // Keep local order in sync when sections change externally (but not during drag)
  useEffect(() => {
    if (!draggedSection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSectionOrder(sections.map((s) => s.id));
    }
  }, [sections, draggedSection]);

  // Get ordered sections based on local state
  const orderedSections = useMemo(
    () =>
      sectionOrder
        .map((id) => sections.find((s) => s.id === id))
        .filter((s): s is FormSectionWithFields => s !== undefined),
    [sectionOrder, sections]
  );

  const handleOpenDialog = (section?: FormSectionWithFields) => {
    if (section) {
      setEditingSection(section);
      setFormData({
        title: section.title,
        description: section.description || "",
        collapsed_by_default: section.collapsed_by_default,
      });
    } else {
      setEditingSection(null);
      setFormData({
        title: "",
        description: "",
        collapsed_by_default: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) return;

    if (editingSection) {
      onUpdateSection(editingSection.id, {
        title: formData.title,
        description: formData.description || null,
        collapsed_by_default: formData.collapsed_by_default,
      });
    } else {
      onAddSection({
        title: formData.title,
        description: formData.description || null,
        collapsed_by_default: formData.collapsed_by_default,
        order_position: sections.length,
        field_ids: [],
      });
    }

    setIsDialogOpen(false);
    setEditingSection(null);
  };

  const toggleExpanded = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleDragStart = (sectionId: string) => {
    setDraggedSection(sectionId);
  };

  const handleSectionDragOver = (e: React.DragEvent, targetId: string) => {
    if (!draggedSection || draggedSection === targetId) return;

    e.preventDefault();

    setSectionOrder((prev) => {
      const draggedIndex = prev.indexOf(draggedSection);
      const targetIndex = prev.indexOf(targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const next = [...prev];
      const [removed] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  };

  const handleFieldDrop = (e: React.DragEvent, sectionId: string) => {
    if (!draggedFieldId || !onDropFieldToSection) return;
    e.preventDefault();
    e.stopPropagation();
    onDropFieldToSection(sectionId, draggedFieldId);
  };

  const handleDragEnd = () => {
    if (sectionOrder.length > 0) {
      onReorderSections(sectionOrder);
    }
    setDraggedSection(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Form Sections</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenDialog()}
          className="h-8"
        >
          <FolderPlus className="w-4 h-4 mr-1" />
          Add Section
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <FolderPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No sections yet</p>
          <p className="text-xs">
            Add sections to organize your form fields. Fields only appear in the
            mobile preview when they are inside a section.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orderedSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const sectionFields = (section.field_ids || [])
              .map((fieldId) => fieldMap.get(fieldId))
              .filter((field): field is FieldConfig => Boolean(field));
            const fieldCount = sectionFields.length;

            return (
              <div
                key={section.id}
                draggable
                onDragStart={() => handleDragStart(section.id)}
                onDragOver={(e) => {
                  if (draggedFieldId && onDropFieldToSection) {
                    e.preventDefault();
                  } else {
                    handleSectionDragOver(e, section.id);
                  }
                }}
                onDrop={(e) => handleFieldDrop(e, section.id)}
                onDragEnd={handleDragEnd}
                className={`border rounded-lg overflow-hidden transition-opacity ${
                  draggedSection === section.id ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-2 p-2 bg-muted/30">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                  <button
                    onClick={() => toggleExpanded(section.id)}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium text-sm">{section.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                    </Badge>
                    {section.collapsed_by_default && (
                      <Badge variant="outline" className="text-xs">
                        collapsed
                      </Badge>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleOpenDialog(section)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDeleteSection(section.id)}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="p-3 text-xs text-muted-foreground bg-background space-y-3">
                    <p>{section.description || "No description"}</p>
                    {sectionFields.length > 0 && (
                      <div className="space-y-2">
                        {sectionFields.map((field) => {
                          const groupId = field.mutually_exclusive_group;
                          const clusterId = field.group_cluster;
                          return (
                            <div
                              key={field.id}
                              className={`flex items-center justify-between rounded-md border bg-background px-3 py-2 text-foreground group ${
                                groupId ? "border-primary/50 bg-primary/5" : ""
                              }`}
                            >
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">
                                  {field.label}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                                  <span>{field.name}</span>
                                  <Badge
                                    variant="outline"
                                    className="text-[11px]"
                                  >
                                    {field.field_type}
                                  </Badge>
                                  {groupId && (
                                    <Badge
                                      variant="outline"
                                      className="text-[11px] border-primary/40 text-primary"
                                    >
                                      Exclusive: {groupId}
                                    </Badge>
                                  )}
                                  {clusterId && (
                                    <Badge
                                      variant="outline"
                                      className="text-[11px] border-dashed border-primary/40 text-primary"
                                    >
                                      Cluster: {clusterId}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onUpdateField && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                      >
                                        <Settings className="w-3 h-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-80 max-h-[70vh] overflow-y-auto"
                                      align="end"
                                    >
                                      <div className="space-y-4">
                                        <h4 className="font-semibold text-sm">
                                          Field Settings
                                        </h4>

                                        {/* Label */}
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            Label
                                          </Label>
                                          <Input
                                            value={field.label}
                                            onChange={(e) =>
                                              onUpdateField(field.id, {
                                                label: e.target.value,
                                              })
                                            }
                                          />
                                        </div>

                                        {/* Description */}
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            Description / Placeholder
                                          </Label>
                                          <Textarea
                                            value={field.description || ""}
                                            onChange={(e) =>
                                              onUpdateField(field.id, {
                                                description:
                                                  e.target.value || null,
                                              })
                                            }
                                            rows={2}
                                          />
                                        </div>

                                        {/* Field Type */}
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            Field Type
                                          </Label>
                                          <Select
                                            value={field.field_type}
                                            onValueChange={(v: string) =>
                                              onUpdateField(field.id, {
                                                field_type: v as FieldType,
                                              })
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {FIELD_TYPES.map(
                                                ({ type, label }) => (
                                                  <SelectItem
                                                    key={type}
                                                    value={type}
                                                  >
                                                    {label}
                                                  </SelectItem>
                                                )
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* Options for select/grouped_breakdown */}
                                        {(field.field_type === "select" ||
                                          field.field_type ===
                                            "grouped_breakdown") && (
                                          <div className="space-y-1">
                                            <Label className="text-xs">
                                              Options (comma-separated)
                                            </Label>
                                            <Input
                                              value={(field.options || []).join(
                                                ", "
                                              )}
                                              onChange={(e) =>
                                                handleOptionsChange(
                                                  field.id,
                                                  e.target.value
                                                )
                                              }
                                              placeholder="Option 1, Option 2, Option 3"
                                            />
                                          </div>
                                        )}

                                        {/* Section Assignment */}
                                        {sections.length > 0 && (
                                          <div className="space-y-1">
                                            <Label className="text-xs">
                                              Section
                                            </Label>
                                            <Select
                                              value={field.section_id || "none"}
                                              onValueChange={(v: string) =>
                                                onUpdateField(field.id, {
                                                  section_id:
                                                    v === "none" ? null : v,
                                                })
                                              }
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="No section" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">
                                                  No section
                                                </SelectItem>
                                                {sections.map((section) => (
                                                  <SelectItem
                                                    key={section.id}
                                                    value={section.id}
                                                  >
                                                    {section.title}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        )}

                                        {/* Required Toggle */}
                                        <div className="flex items-center justify-between">
                                          <Label className="text-xs">
                                            Required Field
                                          </Label>
                                          <Switch
                                            checked={field.required}
                                            onCheckedChange={(
                                              checked: boolean
                                            ) =>
                                              onUpdateField(field.id, {
                                                required: checked,
                                              })
                                            }
                                          />
                                        </div>

                                        {/* Advanced Section */}
                                        <Collapsible
                                          open={
                                            advancedSectionsOpen.get(
                                              field.id
                                            ) || false
                                          }
                                          onOpenChange={(open) => {
                                            setAdvancedSectionsOpen((prev) => {
                                              const next = new Map(prev);
                                              next.set(field.id, open);
                                              return next;
                                            });
                                          }}
                                        >
                                          <CollapsibleTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full justify-between"
                                            >
                                              <span className="text-xs">
                                                Advanced Options
                                              </span>
                                              {advancedSectionsOpen.get(
                                                field.id
                                              ) ? (
                                                <Layers className="w-3 h-3 rotate-180" />
                                              ) : (
                                                <Layers className="w-3 h-3" />
                                              )}
                                            </Button>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="space-y-4 pt-2">
                                            {/* Mutually Exclusive Cluster */}
                                            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                                              <Label className="text-xs">
                                                Mutually Exclusive Cluster
                                              </Label>
                                              <p className="text-[11px] text-muted-foreground">
                                                Assign this field to a cluster
                                                where only one option can be
                                                selected at a time. All clusters
                                                share a single implicit group
                                                behind the scenes.
                                              </p>
                                              {(() => {
                                                // Get all clusters from all fields AND created clusters
                                                const clustersFromFields =
                                                  Array.from(
                                                    new Set(
                                                      fields
                                                        .map(
                                                          (f) => f.group_cluster
                                                        )
                                                        .filter(
                                                          (c): c is string =>
                                                            Boolean(c)
                                                        )
                                                    )
                                                  );
                                                // Combine with created clusters that haven't been assigned yet
                                                const allClusters = Array.from(
                                                  new Set([
                                                    ...clustersFromFields,
                                                    ...createdClusters,
                                                  ])
                                                ).sort();

                                                // Convert cluster ID to display name
                                                const getClusterDisplayName = (
                                                  clusterId: string
                                                ) => {
                                                  return clusterId
                                                    .split("_")
                                                    .map(
                                                      (word) =>
                                                        word
                                                          .charAt(0)
                                                          .toUpperCase() +
                                                        word.slice(1)
                                                    )
                                                    .join(" ");
                                                };

                                                return (
                                                  <div className="space-y-2">
                                                    <Select
                                                      value={
                                                        field.group_cluster ||
                                                        "none"
                                                      }
                                                      onValueChange={(
                                                        value: string
                                                      ) => {
                                                        if (value === "none") {
                                                          onUpdateField(
                                                            field.id,
                                                            {
                                                              mutually_exclusive_group:
                                                                null,
                                                              group_cluster:
                                                                null,
                                                            }
                                                          );
                                                        } else {
                                                          onUpdateField(
                                                            field.id,
                                                            {
                                                              mutually_exclusive_group:
                                                                DEFAULT_EXCLUSIVE_GROUP,
                                                              group_cluster:
                                                                value,
                                                            }
                                                          );
                                                        }
                                                      }}
                                                    >
                                                      <SelectTrigger>
                                                        <SelectValue placeholder="Select existing cluster" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="none">
                                                          No cluster
                                                        </SelectItem>
                                                        {allClusters.map(
                                                          (clusterId) => (
                                                            <SelectItem
                                                              key={clusterId}
                                                              value={clusterId}
                                                            >
                                                              {getClusterDisplayName(
                                                                clusterId
                                                              )}
                                                            </SelectItem>
                                                          )
                                                        )}
                                                      </SelectContent>
                                                    </Select>
                                                    <Input
                                                      value={
                                                        field.group_cluster
                                                          ? getClusterDisplayName(
                                                              field.group_cluster
                                                            )
                                                          : ""
                                                      }
                                                      onChange={(e) => {
                                                        // Allow typing freely; apply on blur
                                                        if (!e.target.value) {
                                                          onUpdateField(
                                                            field.id,
                                                            {
                                                              mutually_exclusive_group:
                                                                null,
                                                              group_cluster:
                                                                null,
                                                            }
                                                          );
                                                        }
                                                      }}
                                                      onBlur={(e) => {
                                                        const clusterName =
                                                          e.target.value.trim();
                                                        if (clusterName) {
                                                          const clusterId =
                                                            clusterName
                                                              .toLowerCase()
                                                              .replace(
                                                                /[^a-z0-9]+/g,
                                                                "_"
                                                              )
                                                              .replace(
                                                                /^_|_$/g,
                                                                ""
                                                              );

                                                          onUpdateField(
                                                            field.id,
                                                            {
                                                              mutually_exclusive_group:
                                                                DEFAULT_EXCLUSIVE_GROUP,
                                                              group_cluster:
                                                                clusterId,
                                                            }
                                                          );
                                                        }
                                                      }}
                                                      placeholder={
                                                        allClusters.length > 0
                                                          ? "Or type new cluster name"
                                                          : "Type cluster name (e.g., Simple Toggle)"
                                                      }
                                                    />
                                                  </div>
                                                );
                                              })()}
                                            </div>

                                            {/* Conditional Logic */}
                                            <ConditionalLogicEditor
                                              field={field}
                                              allFields={fields}
                                              onChange={(logic) =>
                                                onUpdateField(field.id, {
                                                  conditional_logic: logic,
                                                })
                                              }
                                            />
                                          </CollapsibleContent>
                                        </Collapsible>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                {onRemoveFieldFromSection && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() =>
                                      onRemoveFieldFromSection(field.id)
                                    }
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div
                      className={`rounded-md border border-dashed px-3 py-2 text-center ${
                        draggedFieldId ? "border-primary/60 bg-primary/5" : ""
                      }`}
                      onDragOver={(e) => {
                        if (draggedFieldId && onDropFieldToSection) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => handleFieldDrop(e, section.id)}
                    >
                      {sectionFields.length === 0
                        ? "Drag fields here to add to this section"
                        : "Drag additional fields here"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Section Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Add Section"}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? "Update the section details below"
                : "Create a new section to group related fields. Only fields inside sections will appear in the mobile preview."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Section Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g., Customer Information"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of this section"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="collapsed">Collapsed by Default</Label>
                <p className="text-xs text-muted-foreground">
                  Start this section collapsed on mobile
                </p>
              </div>
              <Switch
                id="collapsed"
                checked={formData.collapsed_by_default}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({
                    ...prev,
                    collapsed_by_default: checked,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.title.trim()}>
              {editingSection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
