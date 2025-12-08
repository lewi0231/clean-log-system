"use client";

import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FieldConfig,
  FieldTemplate,
  FieldType,
  FormSectionWithFields,
} from "@clean-log/shared";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  Clock,
  GripVertical,
  Hash,
  Layers,
  List,
  Mail,
  Phone,
  Plus,
  Settings,
  Trash2,
  Type,
} from "lucide-react";
import { ConditionalLogicEditor } from "./conditional-logic-editor";
import { FieldConfigDialog } from "./field-config-dialog";
import { FieldTemplatesPanel } from "./field-templates-panel";
import { MobileDevicePreview } from "./mobile-device-preview";
import { SectionEditor } from "./section-editor";

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

interface VisualFormBuilderProps {
  fields: FieldConfig[];
  sections: FormSectionWithFields[];
  onAddField: (
    field: Omit<
      FieldConfig,
      | "id"
      | "organization_id"
      | "version"
      | "active"
      | "archived_at"
      | "created_at"
      | "updated_at"
    >
  ) => Promise<void>;
  onUpdateField: (
    fieldId: string,
    updates: Partial<FieldConfig>
  ) => Promise<void>;
  onDeleteField: (fieldId: string) => Promise<void>;
  onReorderFields: (fieldIds: string[]) => Promise<void>;
  onAddSection: (
    section: Omit<
      FormSectionWithFields,
      "id" | "organization_id" | "created_at" | "updated_at"
    >
  ) => void | Promise<void>;
  onUpdateSection: (
    sectionId: string,
    updates: Partial<FormSectionWithFields>
  ) => void | Promise<void>;
  onDeleteSection: (sectionId: string) => void | Promise<void>;
  onReorderSections: (sectionIds: string[]) => void | Promise<void>;
  createdClusters?: string[];
}

export function VisualFormBuilder({
  fields,
  sections,
  onAddField,
  onUpdateField,
  onDeleteField,
  onReorderFields,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onReorderSections,
  createdClusters = [],
}: VisualFormBuilderProps) {
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [fieldOrder, setFieldOrder] = useState<string[]>(() =>
    fields.map((f) => f.id)
  );
  const [isAddingField, setIsAddingField] = useState(false);
  const [advancedSectionsOpen, setAdvancedSectionsOpen] = useState<
    Map<string, boolean>
  >(new Map());
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType | null>(
    null
  );

  // Keep local order in sync when fields change externally
  React.useEffect(() => {
    setFieldOrder(fields.map((f) => f.id));
  }, [fields]);

  const orderedFields = React.useMemo(
    () =>
      fieldOrder
        .map((id) => fields.find((f) => f.id === id))
        .filter((f): f is FieldConfig => f !== undefined),
    [fieldOrder, fields]
  );

  // Helper to generate unique field name
  const generateFieldName = (
    label: string,
    existingNames: string[] = fields.map((f) => f.name)
  ): string => {
    const baseName = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    let name = baseName;
    let counter = 1;

    while (existingNames.includes(name)) {
      name = `${baseName}_${counter}`;
      counter++;
    }

    return name;
  };

  // Open field dialog
  const handleOpenFieldDialog = (type: FieldType) => {
    setSelectedFieldType(type);
    setFieldDialogOpen(true);
  };

  // Handle field save from dialog
  const handleSaveFieldFromDialog = async (
    field: Omit<
      FieldConfig,
      | "id"
      | "organization_id"
      | "version"
      | "active"
      | "archived_at"
      | "created_at"
      | "updated_at"
    >
  ) => {
    await onAddField({
      ...field,
      order_position: fields.length,
    });
  };

  // Apply a template
  const handleApplyTemplate = async (template: FieldTemplate) => {
    setIsAddingField(true);
    try {
      // Capture initial state
      let currentOrderPosition = fields.length;
      const existingNames = new Set(fields.map((f) => f.name));

      for (const templateField of template.fields) {
        // Generate unique name checking against both existing fields and previously added template fields
        const name = generateFieldName(
          templateField.label,
          Array.from(existingNames)
        );
        existingNames.add(name); // Track this name to avoid duplicates within the template

        await onAddField({
          name,
          label: templateField.label,
          field_type: templateField.field_type,
          description: templateField.description || null,
          required: templateField.required,
          order_position: currentOrderPosition++,
          validation_rules: templateField.validation_rules || null,
          options: templateField.options || null,
          mutually_exclusive_group: null,
          group_cluster: null,
          section_id: null,
          conditional_logic: null,
        });
      }
    } finally {
      setIsAddingField(false);
    }
  };

  // Update field
  const handleUpdateField = async (
    fieldId: string,
    updates: Partial<FieldConfig>
  ) => {
    await onUpdateField(fieldId, updates);
  };

  // Drag handlers
  const handleDragStart = (fieldId: string) => {
    setDraggedField(fieldId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetId) return;

    setFieldOrder((prev) => {
      const draggedIndex = prev.indexOf(draggedField);
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

  const handleDragEnd = () => {
    if (fieldOrder.length > 0) {
      onReorderFields(fieldOrder);
    }
    setDraggedField(null);
  };

  // Handle options update for select fields
  const handleOptionsChange = async (
    fieldId: string,
    optionsString: string
  ) => {
    const options = optionsString
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    await handleUpdateField(fieldId, {
      options: options.length > 0 ? options : null,
    });
  };

  // Filter out fields that are in sections from the main Form Fields list
  const fieldsNotInSections = React.useMemo(
    () => orderedFields.filter((field) => !field.section_id),
    [orderedFields]
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Form Builder</h2>
        <p className="text-sm text-muted-foreground">
          Drag and drop to reorder fields, click settings to configure
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Fields only appear in the mobile preview when they are assigned to a
          section.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start min-h-screen">
        {/* Left Panel - Field Configuration */}
        <div className="flex-1 flex flex-col space-y-4 w-full min-w-0">
          {/* Field Type Selector */}
          <Card className="shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Add Field</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-5 gap-2">
                {FIELD_TYPES.map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenFieldDialog(type)}
                    disabled={isAddingField}
                    className="flex flex-col items-center justify-center gap-1 h-auto py-2 px-1"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Templates Panel */}
          <FieldTemplatesPanel onApplyTemplate={handleApplyTemplate} />

          {/* Sections Editor */}
          <Card className="shrink-0">
            <CardContent className="pt-4">
              <SectionEditor
                sections={sections}
                fields={fields}
                onAddSection={onAddSection}
                onUpdateSection={onUpdateSection}
                onDeleteSection={onDeleteSection}
                onReorderSections={onReorderSections}
                draggedFieldId={draggedField}
                onDropFieldToSection={async (sectionId, fieldId) => {
                  await onUpdateField(fieldId, { section_id: sectionId });
                  setDraggedField(null);
                }}
                onRemoveFieldFromSection={async (fieldId) => {
                  await onUpdateField(fieldId, { section_id: null });
                }}
                onUpdateField={onUpdateField}
                onReorderFields={onReorderFields}
                createdClusters={createdClusters}
              />
            </CardContent>
          </Card>

          {/* Fields List */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Form Fields
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {fieldsNotInSections.length} fields
                  </Badge>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Field
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="grid grid-cols-2 gap-2">
                        {FIELD_TYPES.map(({ type, icon: Icon, label }) => (
                          <Button
                            key={type}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFieldDialog(type)}
                            disabled={isAddingField}
                            className="flex flex-col items-center justify-center gap-1 h-auto py-2 px-1"
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-[10px]">{label}</span>
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TooltipProvider>
                <div className="space-y-2">
                  {fieldsNotInSections.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Plus className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No fields yet</p>
                      <p className="text-xs">
                        Add a field or use a template to get started
                      </p>
                    </div>
                  ) : (
                    (() => {
                      let previousGroup: string | null = null;

                      // Helper to convert group ID to display name
                      const getGroupDisplayName = (groupId: string): string => {
                        return groupId
                          .split("_")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1)
                          )
                          .join(" ");
                      };

                      return fieldsNotInSections.map((field) => {
                        const FieldIcon =
                          FIELD_TYPES.find((t) => t.type === field.field_type)
                            ?.icon || Type;
                        const groupId = field.mutually_exclusive_group;
                        const clusterId = field.group_cluster;
                        const showGroupDivider =
                          Boolean(groupId) && groupId !== previousGroup;
                        previousGroup = groupId || null;

                        return (
                          <React.Fragment key={field.id}>
                            {showGroupDivider && groupId && (
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary/80 mt-4">
                                <Layers className="w-3 h-3" />
                                <span>
                                  Choose one: {getGroupDisplayName(groupId)}
                                </span>
                                <div className="flex-1 border-t border-dashed border-primary/40" />
                              </div>
                            )}
                            <div
                              draggable
                              onDragStart={() => handleDragStart(field.id)}
                              onDragOver={(e) => handleDragOver(e, field.id)}
                              onDragEnd={handleDragEnd}
                              className={`group flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-all cursor-move ${
                                groupId
                                  ? "bg-primary/5 border-primary/50"
                                  : "bg-card"
                              } ${
                                draggedField === field.id
                                  ? "opacity-50 scale-[0.98]"
                                  : ""
                              }`}
                            >
                              <GripVertical className="w-5 h-5 text-muted-foreground shrink-0" />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <FieldIcon className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium text-sm truncate">
                                    {field.label}
                                  </span>
                                  {field.required && (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px] px-1.5"
                                    >
                                      Required
                                    </Badge>
                                  )}
                                  {field.conditional_logic && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5"
                                    >
                                      Conditional
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5"
                                  >
                                    {field.field_type}
                                  </Badge>
                                  <span className="font-mono truncate">
                                    {field.name}
                                  </span>
                                  {!field.section_id && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5"
                                    >
                                      No section
                                    </Badge>
                                  )}
                                  {groupId && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 text-primary border-primary/40"
                                    >
                                      Exclusive: {groupId}
                                    </Badge>
                                  )}
                                  {clusterId && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 border-dashed border-primary/40 text-primary"
                                        >
                                          Cluster: {clusterId}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Fields sharing a cluster act as one
                                        option inside their exclusive group
                                        (e.g., wiped + soaped details).
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>

                              {/* Field Settings Popover */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Settings className="w-4 h-4" />
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
                                        <Label className="text-xs">Label</Label>
                                        <Input
                                          value={field.label}
                                          onChange={(e) =>
                                            handleUpdateField(field.id, {
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
                                            handleUpdateField(field.id, {
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
                                            handleUpdateField(field.id, {
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
                                              handleUpdateField(field.id, {
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
                                          onCheckedChange={(checked: boolean) =>
                                            handleUpdateField(field.id, {
                                              required: checked,
                                            })
                                          }
                                        />
                                      </div>

                                      {/* Advanced Section */}
                                      <Collapsible
                                        open={
                                          advancedSectionsOpen.get(field.id) ||
                                          false
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
                                                        handleUpdateField(
                                                          field.id,
                                                          {
                                                            mutually_exclusive_group:
                                                              null,
                                                            group_cluster: null,
                                                          }
                                                        );
                                                      } else {
                                                        handleUpdateField(
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
                                                        handleUpdateField(
                                                          field.id,
                                                          {
                                                            mutually_exclusive_group:
                                                              null,
                                                            group_cluster: null,
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

                                                        handleUpdateField(
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
                                              handleUpdateField(field.id, {
                                                conditional_logic: logic,
                                              })
                                            }
                                          />
                                        </CollapsibleContent>
                                      </Collapsible>
                                    </div>
                                  </PopoverContent>
                                </Popover>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => onDeleteField(field.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      });
                    })()
                  )}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Mobile Preview */}
        <div className="hidden lg:block w-80 shrink-0 self-start sticky top-0">
          <Card className=" p-6">
            <MobileDevicePreview
              fields={fields}
              sections={sections}
              formTitle="New Entry"
              formDescription="Fill out the form below"
            />
            <div className="mt-4 p-3 rounded-md bg-muted/50 border border-muted">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Fields will not appear in the preview
                unless they are added to a Section.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Field Configuration Dialog */}
      {selectedFieldType && (
        <FieldConfigDialog
          open={fieldDialogOpen}
          onOpenChange={setFieldDialogOpen}
          fieldType={selectedFieldType}
          sections={sections}
          existingFieldNames={fields.map((f) => f.name)}
          onSave={handleSaveFieldFromDialog}
        />
      )}
    </div>
  );
}
