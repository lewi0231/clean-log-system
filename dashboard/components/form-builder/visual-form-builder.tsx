"use client";

import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}: VisualFormBuilderProps) {
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [fieldOrder, setFieldOrder] = useState<string[]>(() =>
    fields.map((f) => f.id)
  );
  const [isAddingField, setIsAddingField] = useState(false);

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
  const generateFieldName = (label: string): string => {
    const baseName = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    const existingNames = fields.map((f) => f.name);
    let name = baseName;
    let counter = 1;

    while (existingNames.includes(name)) {
      name = `${baseName}_${counter}`;
      counter++;
    }

    return name;
  };

  // Add a new field
  const handleAddField = async (type: FieldType) => {
    const label = `New ${
      FIELD_TYPES.find((t) => t.type === type)?.label || type
    } Field`;
    const name = generateFieldName(label);

    setIsAddingField(true);
    try {
      await onAddField({
        name,
        label,
        field_type: type,
        description: null,
        required: false,
        order_position: fields.length,
        validation_rules: null,
        options:
          type === "select" || type === "grouped_breakdown"
            ? ["Option 1", "Option 2"]
            : null,
        mutually_exclusive_group: null,
        group_cluster: null,
        section_id: null,
        conditional_logic: null,
      });
    } finally {
      setIsAddingField(false);
    }
  };

  // Apply a template
  const handleApplyTemplate = async (template: FieldTemplate) => {
    setIsAddingField(true);
    try {
      for (const templateField of template.fields) {
        const name = generateFieldName(templateField.label);
        await onAddField({
          name,
          label: templateField.label,
          field_type: templateField.field_type,
          description: templateField.description || null,
          required: templateField.required,
          order_position: fields.length,
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
  const handleOptionsChange = (fieldId: string, optionsString: string) => {
    const options = optionsString
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    handleUpdateField(fieldId, {
      options: options.length > 0 ? options : null,
    });
  };

  return (
    <div className="flex flex-col h-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Form Builder</h2>
        <p className="text-sm text-muted-foreground">
          Drag and drop to reorder fields, click settings to configure
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Panel - Field Configuration */}
        <div className="lg:col-span-2 flex flex-col space-y-4 overflow-hidden">
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
                    onClick={() => handleAddField(type)}
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
                onDropFieldToSection={(sectionId, fieldId) => {
                  onUpdateField(fieldId, { section_id: sectionId });
                  setDraggedField(null);
                }}
                onRemoveFieldFromSection={(fieldId) => {
                  onUpdateField(fieldId, { section_id: null });
                }}
              />
            </CardContent>
          </Card>

          {/* Fields List */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Form Fields
                </CardTitle>
                <Badge variant="secondary">{fields.length} fields</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-auto">
              <div className="space-y-2">
                {orderedFields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Plus className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No fields yet</p>
                    <p className="text-xs">
                      Add a field or use a template to get started
                    </p>
                  </div>
                ) : (
                  orderedFields.map((field) => {
                    const FieldIcon =
                      FIELD_TYPES.find((t) => t.type === field.field_type)
                        ?.icon || Type;

                    return (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={() => handleDragStart(field.id)}
                        onDragOver={(e) => handleDragOver(e, field.id)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-center gap-3 p-3 bg-card border rounded-lg hover:border-primary/50 transition-all cursor-move ${
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
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5"
                            >
                              {field.field_type}
                            </Badge>
                            <span className="font-mono truncate">
                              {field.name}
                            </span>
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
                                        description: e.target.value || null,
                                      })
                                    }
                                    rows={2}
                                  />
                                </div>

                                {/* Field Type */}
                                <div className="space-y-1">
                                  <Label className="text-xs">Field Type</Label>
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
                                      {FIELD_TYPES.map(({ type, label }) => (
                                        <SelectItem key={type} value={type}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Options for select/grouped_breakdown */}
                                {(field.field_type === "select" ||
                                  field.field_type === "grouped_breakdown") && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      Options (comma-separated)
                                    </Label>
                                    <Input
                                      value={(field.options || []).join(", ")}
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
                                    <Label className="text-xs">Section</Label>
                                    <Select
                                      value={field.section_id || "none"}
                                      onValueChange={(v: string) =>
                                        handleUpdateField(field.id, {
                                          section_id: v === "none" ? null : v,
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
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Mobile Preview */}
        <div className="hidden lg:flex flex-col">
          <Card className="flex-1 p-6 overflow-hidden">
            <MobileDevicePreview
              fields={fields}
              sections={sections}
              formTitle="New Entry"
              formDescription="Fill out the form below"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
