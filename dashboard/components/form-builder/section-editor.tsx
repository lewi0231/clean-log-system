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
import { useEffect, useMemo, useRef, useState } from "react";
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
  onReorderFields?: (fieldIds: string[]) => Promise<void>;
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
  onReorderFields,
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
  const [draggedSectionField, setDraggedSectionField] = useState<string | null>(
    null
  );
  const [sectionFieldOrders, setSectionFieldOrders] = useState<
    Map<string, string[]>
  >(() => new Map(sections.map((s) => [s.id, s.field_ids || []])));
  const [advancedSectionsOpen, setAdvancedSectionsOpen] = useState<
    Map<string, boolean>
  >(new Map());
  // Local state for text inputs to prevent re-render issues during typing
  const [optionsInputValues, setOptionsInputValues] = useState<
    Map<string, string>
  >(new Map());
  const [labelInputValues, setLabelInputValues] = useState<Map<string, string>>(
    new Map()
  );
  const [descriptionInputValues, setDescriptionInputValues] = useState<
    Map<string, string>
  >(new Map());
  // Track which fields are currently being edited to prevent sync overwrites
  const editingFieldsRef = useRef<Set<string>>(new Set());
  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields]
  );

  // Handle options update for select fields - update local state immediately
  const handleOptionsChange = (fieldId: string, optionsString: string) => {
    editingFieldsRef.current.add(fieldId);
    setOptionsInputValues((prev) => {
      const next = new Map(prev);
      next.set(fieldId, optionsString);
      return next;
    });
  };

  // Save all pending changes for a field when popover closes
  const handlePopoverClose = async (fieldId: string) => {
    if (!onUpdateField) return;

    const updates: Partial<FieldConfig> = {};
    let hasChanges = false;

    // Save label if changed
    if (labelInputValues.has(fieldId)) {
      updates.label = labelInputValues.get(fieldId) || "";
      hasChanges = true;
    }

    // Save description if changed
    if (descriptionInputValues.has(fieldId)) {
      updates.description = descriptionInputValues.get(fieldId) || null;
      hasChanges = true;
    }

    // Save options if changed
    if (optionsInputValues.has(fieldId)) {
      const optionsString = optionsInputValues.get(fieldId) || "";
      const options = optionsString
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      updates.options = options.length > 0 ? options : null;
      hasChanges = true;
    }

    // Only update if there are actual changes
    if (hasChanges) {
      await onUpdateField(fieldId, updates);
    }

    // Clear all local state for this field after saving
    setLabelInputValues((prev) => {
      const next = new Map(prev);
      next.delete(fieldId);
      return next;
    });
    setDescriptionInputValues((prev) => {
      const next = new Map(prev);
      next.delete(fieldId);
      return next;
    });
    setOptionsInputValues((prev) => {
      const next = new Map(prev);
      next.delete(fieldId);
      return next;
    });
    editingFieldsRef.current.delete(fieldId);
  };

  // Get the current options input value, falling back to field value if not in local state
  const getOptionsInputValue = (
    fieldId: string,
    field: FieldConfig
  ): string => {
    if (optionsInputValues.has(fieldId)) {
      return optionsInputValues.get(fieldId) || "";
    }
    return (field.options || []).join(", ");
  };

  // Handle label update - update local state immediately
  const handleLabelChange = (fieldId: string, label: string) => {
    editingFieldsRef.current.add(fieldId);
    setLabelInputValues((prev) => {
      const next = new Map(prev);
      next.set(fieldId, label);
      return next;
    });
  };

  // Get the current label input value, falling back to field value if not in local state
  const getLabelInputValue = (fieldId: string, field: FieldConfig): string => {
    if (labelInputValues.has(fieldId)) {
      return labelInputValues.get(fieldId) || "";
    }
    return field.label;
  };

  // Handle description update - update local state immediately
  const handleDescriptionChange = (fieldId: string, description: string) => {
    editingFieldsRef.current.add(fieldId);
    setDescriptionInputValues((prev) => {
      const next = new Map(prev);
      next.set(fieldId, description);
      return next;
    });
  };

  // Get the current description input value, falling back to field value if not in local state
  const getDescriptionInputValue = (
    fieldId: string,
    field: FieldConfig
  ): string => {
    if (descriptionInputValues.has(fieldId)) {
      return descriptionInputValues.get(fieldId) || "";
    }
    return field.description || "";
  };

  // Keep local order in sync when sections change externally (but not during drag)
  useEffect(() => {
    if (!draggedSection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSectionOrder(sections.map((s) => s.id));
    }
  }, [sections, draggedSection]);

  // Keep section field orders in sync when sections change externally
  useEffect(() => {
    if (!draggedSectionField) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSectionFieldOrders(
        new Map(sections.map((s) => [s.id, s.field_ids || []]))
      );
    }
  }, [sections, draggedSectionField]);

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

  // Section field drag handlers
  const handleSectionFieldDragStart = (sectionId: string, fieldId: string) => {
    setDraggedSectionField(fieldId);
  };

  const handleSectionFieldDragOver = (
    e: React.DragEvent,
    sectionId: string,
    targetFieldId: string
  ) => {
    e.preventDefault();
    if (!draggedSectionField || draggedSectionField === targetFieldId) return;

    setSectionFieldOrders((prev) => {
      const currentOrder = prev.get(sectionId) || [];
      const draggedIndex = currentOrder.indexOf(draggedSectionField);
      const targetIndex = currentOrder.indexOf(targetFieldId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const next = [...currentOrder];
      const [removed] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, removed);

      const updated = new Map(prev);
      updated.set(sectionId, next);
      return updated;
    });
  };

  const handleSectionFieldDragEnd = async (sectionId: string) => {
    const newOrder = sectionFieldOrders.get(sectionId);
    if (!newOrder || newOrder.length === 0) {
      setDraggedSectionField(null);
      return;
    }

    // If we have onReorderFields, use it to update all fields' order_position
    // This ensures the order persists after refetch
    if (onReorderFields) {
      // Get all fields ordered by their current order_position
      const allFieldsOrdered = [...fields].sort(
        (a, b) => a.order_position - b.order_position
      );

      // Split into: fields before this section, fields in this section (reordered), fields after this section
      const sectionFieldsInNewOrder = newOrder
        .map((id) => fieldMap.get(id))
        .filter((f): f is FieldConfig => Boolean(f));

      const fieldsBeforeSection = allFieldsOrdered.filter(
        (f) => f.section_id !== sectionId
      );

      // Find where this section's fields start in the global order
      const firstSectionField = allFieldsOrdered.find(
        (f) => f.section_id === sectionId
      );
      const sectionStartIndex = firstSectionField
        ? allFieldsOrdered.indexOf(firstSectionField)
        : fieldsBeforeSection.length;

      // Reconstruct the full order: fields before + reordered section fields + fields after
      const newFullOrder = [
        ...fieldsBeforeSection.slice(0, sectionStartIndex),
        ...sectionFieldsInNewOrder,
        ...fieldsBeforeSection.slice(sectionStartIndex),
      ]
        .map((f) => f.id)
        .filter((id) => id !== undefined);

      // Call onReorderFields with the full ordered list
      await onReorderFields(newFullOrder);
    } else {
      // Fallback: just update the section's field_ids
      onUpdateSection(sectionId, { field_ids: newOrder });
    }
    setDraggedSectionField(null);
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
                  // If dragging a field from main list into section, allow drop
                  if (draggedFieldId && onDropFieldToSection) {
                    e.preventDefault();
                  }
                  // If dragging a field within the section, ignore section drag
                  else if (draggedSectionField) {
                    // Don't interfere with field reordering within section
                    return;
                  }
                  // Otherwise handle section reordering
                  else {
                    handleSectionDragOver(e, section.id);
                  }
                }}
                onDrop={(e) => {
                  // Only handle drop if dragging from main fields list, not from within section
                  if (draggedFieldId && !draggedSectionField) {
                    handleFieldDrop(e, section.id);
                  }
                }}
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
                    {(() => {
                      // Get ordered field IDs for this section
                      const orderedFieldIds =
                        sectionFieldOrders.get(section.id) ||
                        section.field_ids ||
                        [];
                      // Map to ordered fields
                      const orderedSectionFields = orderedFieldIds
                        .map((fieldId) => fieldMap.get(fieldId))
                        .filter((field): field is FieldConfig =>
                          Boolean(field)
                        );

                      return (
                        sectionFields.length > 0 && (
                          <div className="space-y-2">
                            {orderedSectionFields.map((field) => {
                              const groupId = field.mutually_exclusive_group;
                              const clusterId = field.group_cluster;
                              return (
                                <div
                                  key={field.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    handleSectionFieldDragStart(
                                      section.id,
                                      field.id
                                    );
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSectionFieldDragOver(
                                      e,
                                      section.id,
                                      field.id
                                    );
                                  }}
                                  onDragEnd={(e) => {
                                    e.stopPropagation();
                                    handleSectionFieldDragEnd(section.id);
                                  }}
                                  className={`flex items-center justify-between rounded-md border bg-background px-3 py-2 text-foreground group cursor-move ${
                                    groupId
                                      ? "border-primary/50 bg-primary/5"
                                      : ""
                                  } ${
                                    draggedSectionField === field.id
                                      ? "opacity-50 scale-[0.98]"
                                      : ""
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
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {onUpdateField && (
                                        <Popover
                                          onOpenChange={(open) => {
                                            if (!open) {
                                              // Popover is closing, save all changes
                                              handlePopoverClose(field.id);
                                            }
                                          }}
                                        >
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
                                                  value={getLabelInputValue(
                                                    field.id,
                                                    field
                                                  )}
                                                  onChange={(e) =>
                                                    handleLabelChange(
                                                      field.id,
                                                      e.target.value
                                                    )
                                                  }
                                                />
                                              </div>

                                              {/* Description */}
                                              <div className="space-y-1">
                                                <Label className="text-xs">
                                                  Description / Placeholder
                                                </Label>
                                                <Textarea
                                                  value={getDescriptionInputValue(
                                                    field.id,
                                                    field
                                                  )}
                                                  onChange={(e) =>
                                                    handleDescriptionChange(
                                                      field.id,
                                                      e.target.value
                                                    )
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
                                                  onValueChange={async (
                                                    v: string
                                                  ) => {
                                                    if (onUpdateField) {
                                                      await onUpdateField(
                                                        field.id,
                                                        {
                                                          field_type:
                                                            v as FieldType,
                                                        }
                                                      );
                                                    }
                                                  }}
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
                                                    value={getOptionsInputValue(
                                                      field.id,
                                                      field
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
                                                    value={
                                                      field.section_id || "none"
                                                    }
                                                    onValueChange={async (
                                                      v: string
                                                    ) => {
                                                      if (onUpdateField) {
                                                        await onUpdateField(
                                                          field.id,
                                                          {
                                                            section_id:
                                                              v === "none"
                                                                ? null
                                                                : v,
                                                          }
                                                        );
                                                      }
                                                    }}
                                                  >
                                                    <SelectTrigger>
                                                      <SelectValue placeholder="No section" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="none">
                                                        No section
                                                      </SelectItem>
                                                      {sections.map(
                                                        (section) => (
                                                          <SelectItem
                                                            key={section.id}
                                                            value={section.id}
                                                          >
                                                            {section.title}
                                                          </SelectItem>
                                                        )
                                                      )}
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
                                                  onCheckedChange={async (
                                                    checked: boolean
                                                  ) => {
                                                    if (onUpdateField) {
                                                      await onUpdateField(
                                                        field.id,
                                                        {
                                                          required: checked,
                                                        }
                                                      );
                                                    }
                                                  }}
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
                                                  setAdvancedSectionsOpen(
                                                    (prev) => {
                                                      const next = new Map(
                                                        prev
                                                      );
                                                      next.set(field.id, open);
                                                      return next;
                                                    }
                                                  );
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
                                                      Assign this field to a
                                                      cluster where only one
                                                      option can be selected at
                                                      a time. All clusters share
                                                      a single implicit group
                                                      behind the scenes.
                                                    </p>
                                                    {(() => {
                                                      // Get all clusters from all fields AND created clusters
                                                      const clustersFromFields =
                                                        Array.from(
                                                          new Set(
                                                            fields
                                                              .map(
                                                                (f) =>
                                                                  f.group_cluster
                                                              )
                                                              .filter(
                                                                (
                                                                  c
                                                                ): c is string =>
                                                                  Boolean(c)
                                                              )
                                                          )
                                                        );
                                                      // Combine with created clusters that haven't been assigned yet
                                                      const allClusters =
                                                        Array.from(
                                                          new Set([
                                                            ...clustersFromFields,
                                                            ...createdClusters,
                                                          ])
                                                        ).sort();

                                                      // Convert cluster ID to display name
                                                      const getClusterDisplayName =
                                                        (clusterId: string) => {
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
                                                            onValueChange={async (
                                                              value: string
                                                            ) => {
                                                              if (
                                                                !onUpdateField
                                                              )
                                                                return;
                                                              if (
                                                                value === "none"
                                                              ) {
                                                                await onUpdateField(
                                                                  field.id,
                                                                  {
                                                                    mutually_exclusive_group:
                                                                      null,
                                                                    group_cluster:
                                                                      null,
                                                                  }
                                                                );
                                                              } else {
                                                                await onUpdateField(
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
                                                                    key={
                                                                      clusterId
                                                                    }
                                                                    value={
                                                                      clusterId
                                                                    }
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
                                                            onChange={async (
                                                              e
                                                            ) => {
                                                              // Allow typing freely; apply on blur
                                                              if (
                                                                !e.target
                                                                  .value &&
                                                                onUpdateField
                                                              ) {
                                                                const result =
                                                                  onUpdateField(
                                                                    field.id,
                                                                    {
                                                                      mutually_exclusive_group:
                                                                        null,
                                                                      group_cluster:
                                                                        null,
                                                                    }
                                                                  );
                                                                if (
                                                                  result instanceof
                                                                  Promise
                                                                ) {
                                                                  await result;
                                                                }
                                                              }
                                                            }}
                                                            onBlur={async (
                                                              e
                                                            ) => {
                                                              if (
                                                                !onUpdateField
                                                              )
                                                                return;
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

                                                                await onUpdateField(
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
                                                              allClusters.length >
                                                              0
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
                                                    onChange={async (logic) => {
                                                      if (onUpdateField) {
                                                        await onUpdateField(
                                                          field.id,
                                                          {
                                                            conditional_logic:
                                                              logic,
                                                          }
                                                        );
                                                      }
                                                    }}
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
                                </div>
                              );
                            })}
                          </div>
                        )
                      );
                    })()}
                    <div
                      className={`rounded-md border border-dashed px-3 py-2 text-center ${
                        draggedFieldId && !draggedSectionField
                          ? "border-primary/60 bg-primary/5"
                          : ""
                      }`}
                      onDragOver={(e) => {
                        if (
                          draggedFieldId &&
                          !draggedSectionField &&
                          onDropFieldToSection
                        ) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        if (draggedFieldId && !draggedSectionField) {
                          handleFieldDrop(e, section.id);
                        }
                      }}
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
