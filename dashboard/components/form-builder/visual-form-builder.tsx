"use client";

import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { FieldConfig, FieldType, FormSectionWithFields } from "@clean-log/shared";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  Clock,
  GripVertical,
  Hash,
  Image,
  Layers,
  List,
  Mail,
  MapPin,
  Phone,
  Plus,
  Settings,
  Trash2,
  Type,
} from "lucide-react";
import { FieldConfigDialog } from "./field-config-dialog";
import { LocationRestrictionPicker } from "./location-restriction-picker";
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
  { type: "image", icon: Image, label: "Image" },
  { type: "address", icon: MapPin, label: "Address" },
  { type: "grouped_breakdown", icon: Layers, label: "Grouped" },
];

interface VisualFormBuilderProps {
  fields: FieldConfig[];
  sections: FormSectionWithFields[];
  onAddField: (
    field: Omit<
      FieldConfig,
      "id" | "organization_id" | "version" | "active" | "archived_at" | "created_at" | "updated_at"
    >
  ) => Promise<void>;
  onUpdateField: (fieldId: string, updates: Partial<FieldConfig>) => Promise<void>;
  onDeleteField: (fieldId: string) => Promise<void>;
  onReorderFields: (fieldIds: string[]) => Promise<void>;
  onAddSection: (
    section: Omit<FormSectionWithFields, "id" | "organization_id" | "created_at" | "updated_at">
  ) => void | Promise<void>;
  onUpdateSection: (
    sectionId: string,
    updates: Partial<FormSectionWithFields>
  ) => void | Promise<void>;
  onDeleteSection: (sectionId: string) => void | Promise<void>;
  onReorderSections: (sectionIds: string[]) => void | Promise<void>;
  organizationId: string | null;
  onOpenFieldGroupSettings?: () => void;
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
  organizationId,
  onOpenFieldGroupSettings,
}: VisualFormBuilderProps) {
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [draggedSectionField, setDraggedSectionField] = useState<string | null>(null);
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => fields.map((f) => f.id));
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  /** Increment when opening the add-field dialog so FieldConfigDialog remounts with fresh state. */
  const [fieldDialogSession, setFieldDialogSession] = useState(0);
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType | null>(null);
  const [locationRestrictionsMap, setLocationRestrictionsMap] = useState<Map<string, string[]>>(
    new Map()
  );
  const [restrictToLocationsMap, setRestrictToLocationsMap] = useState<Map<string, boolean>>(
    new Map()
  );

  const { locations } = useLocations();
  const { settings } = useOrganizationSettings();

  // Keep local order in sync when fields change externally
  // Include any new fields that aren't in fieldOrder yet (e.g., optimistic adds)
  React.useEffect(() => {
    setFieldOrder((prev) => {
      const currentIds = new Set(prev);
      const newIds = fields.map((f) => f.id);
      const addedIds = newIds.filter((id) => !currentIds.has(id));
      const removedIds = new Set(prev.filter((id) => !newIds.includes(id)));

      // If nothing changed, return previous to avoid re-render
      if (addedIds.length === 0 && removedIds.size === 0) {
        return prev;
      }

      // Keep existing order for fields that still exist, append new ones
      const filtered = prev.filter((id) => !removedIds.has(id));
      return [...filtered, ...addedIds];
    });
  }, [fields]);

  // Track field IDs that we've loaded location restrictions for
  const loadedRestrictionsRef = React.useRef<Set<string>>(new Set());

  // Load location restrictions for fields - only fetch for IDs we haven't loaded yet
  React.useEffect(() => {
    if (!organizationId) return;

    // Find field IDs that have real IDs (not temp-*) and haven't been loaded yet
    const realFieldIds = fields.filter((f) => !f.id.startsWith("temp-")).map((f) => f.id);
    const unloadedIds = realFieldIds.filter((id) => !loadedRestrictionsRef.current.has(id));

    // If all fields are loaded or there are no real fields, skip
    if (unloadedIds.length === 0) return;

    async function fetchAllLocationRestrictions() {
      try {
        const { data, error } = await supabase.functions.invoke("list-field-configs", {
          body: {
            organization_id: organizationId,
            include_location_restrictions: true,
          },
        });

        if (error) throw error;

        const restrictionsMap = new Map<string, string[]>();
        const restrictMap = new Map<string, boolean>();

        (data?.field_configs || []).forEach(
          (fc: FieldConfig & { location_restrictions?: string[] }) => {
            loadedRestrictionsRef.current.add(fc.id);
            if (fc.location_restrictions && fc.location_restrictions.length > 0) {
              restrictionsMap.set(fc.id, fc.location_restrictions);
              restrictMap.set(fc.id, true);
            } else {
              restrictMap.set(fc.id, false);
            }
          }
        );

        setLocationRestrictionsMap((prev) => {
          const next = new Map(prev);
          restrictionsMap.forEach((v, k) => next.set(k, v));
          return next;
        });
        setRestrictToLocationsMap((prev) => {
          const next = new Map(prev);
          restrictMap.forEach((v, k) => next.set(k, v));
          return next;
        });
      } catch (err) {
        log.error("Failed to fetch location restrictions", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    fetchAllLocationRestrictions();
  }, [organizationId, fields]);

  // Compute ordered fields - use fieldOrder but include any new fields not yet in the order
  const orderedFields = React.useMemo(() => {
    const fieldMap = new Map(fields.map((f) => [f.id, f]));
    const inOrder = fieldOrder
      .map((id) => fieldMap.get(id))
      .filter((f): f is FieldConfig => f !== undefined);

    // Add any fields that aren't in fieldOrder yet (optimistic adds)
    const inOrderIds = new Set(fieldOrder);
    const notInOrder = fields.filter((f) => !inOrderIds.has(f.id));

    return [...inOrder, ...notInOrder];
  }, [fieldOrder, fields]);

  // Open field dialog
  const handleOpenFieldDialog = (type: FieldType) => {
    setFieldDialogSession((s) => s + 1);
    setSelectedFieldType(type);
    setFieldDialogOpen(true);
  };

  // Handle field save from dialog
  const handleSaveFieldFromDialog = async (
    field: Omit<
      FieldConfig,
      "id" | "organization_id" | "version" | "active" | "archived_at" | "created_at" | "updated_at"
    >
  ) => {
    await onAddField({
      ...field,
      order_position: fields.length,
    });
  };

  // Load location restrictions for a field
  const loadLocationRestrictions = async (fieldId: string) => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase.functions.invoke("list-field-configs", {
        body: {
          organization_id: organizationId,
          include_location_restrictions: true,
        },
      });

      if (error) throw error;

      const config = data?.field_configs?.find(
        (fc: FieldConfig & { location_restrictions?: string[] }) => fc.id === fieldId
      );

      if (config?.location_restrictions && config.location_restrictions.length > 0) {
        setRestrictToLocationsMap((prev) => {
          const next = new Map(prev);
          next.set(fieldId, true);
          return next;
        });
        setLocationRestrictionsMap((prev) => {
          const next = new Map(prev);
          next.set(fieldId, config.location_restrictions || []);
          return next;
        });
      } else {
        setRestrictToLocationsMap((prev) => {
          const next = new Map(prev);
          next.set(fieldId, false);
          return next;
        });
        setLocationRestrictionsMap((prev) => {
          const next = new Map(prev);
          next.set(fieldId, []);
          return next;
        });
      }
    } catch (err) {
      log.error("Failed to load location restrictions", {
        error: err instanceof Error ? err.message : "Unknown error",
        fieldId,
      });
    }
  };

  // Update field
  const handleUpdateField = async (fieldId: string, updates: Partial<FieldConfig>) => {
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
  const handleOptionsChange = async (fieldId: string, optionsString: string) => {
    const options = optionsString
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    await handleUpdateField(fieldId, {
      options: options.length > 0 ? options : null,
    });
  };

  // Filter out fields that are in sections from the main Form Fields list
  // Also exclude the draggedSectionField if it's being dragged to form fields
  // to prevent duplicate keys during drag operations
  const fieldsNotInSections = React.useMemo(
    () => orderedFields.filter((field) => !field.section_id && field.id !== draggedSectionField),
    [orderedFields, draggedSectionField]
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Form Builder</h2>
          <ContextualHelp label="How the form builder works" side="right">
            <p>
              The mobile app starts with required steps: colleagues (if enabled), locations (if
              customer locations are on), and start/finish times. Each <strong>section</strong> you
              add becomes its own screen for extra job fields.
            </p>
            <p className="mt-2">
              <strong>Drag and drop</strong> to reorder. Fields only appear in the preview when they
              are assigned to a section.
            </p>
          </ContextualHelp>
        </div>
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
              <TooltipProvider>
                <div className="grid grid-cols-5 gap-2">
                  {FIELD_TYPES.map(({ type, icon: Icon, label }) => {
                    const fieldTypeDescriptions: Record<
                      FieldType,
                      { description: string; example: string }
                    > = {
                      text: {
                        description: "Single-line text input",
                        example: "e.g., Customer name, Vehicle model",
                      },
                      number: {
                        description: "Numeric input for quantities or measurements",
                        example: "e.g., Number of items, Distance in miles",
                      },
                      email: {
                        description: "Email address input with validation",
                        example: "e.g., customer@example.com",
                      },
                      phone: {
                        description: "Phone number input",
                        example: "e.g., (555) 123-4567",
                      },
                      select: {
                        description: "Dropdown menu with predefined options",
                        example: "e.g., Service type: Basic, Premium, Deluxe",
                      },
                      textarea: {
                        description: "Multi-line text input for longer content",
                        example: "e.g., Notes, Comments, Description",
                      },
                      date: {
                        description: "Date picker for selecting a date",
                        example: "e.g., Appointment date, Due date",
                      },
                      time: {
                        description: "Time picker for selecting a time",
                        example: "e.g., Start time, End time",
                      },
                      boolean: {
                        description: "Checkbox for yes/no or true/false values",
                        example: "e.g., Completed, Verified, Approved",
                      },
                      image: {
                        description: "Image upload for photos or documents",
                        example: "e.g., Before/after photos, Damage documentation",
                      },
                      address: {
                        description: "Address input with autocomplete suggestions",
                        example: "e.g., Customer address, Service location",
                      },
                      grouped_breakdown: {
                        description: "Grouped breakdown for itemized lists with quantities",
                        example: "e.g., Services performed with quantities",
                      },
                    };

                    const typeInfo = fieldTypeDescriptions[type];

                    return (
                      <Tooltip key={type}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenFieldDialog(type)}
                            className="flex flex-col items-center justify-center gap-1 h-auto py-2 px-1 cursor-pointer"
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-[10px]">{label}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium text-xs text-slate-50">{label}</p>
                            <p className="text-xs text-slate-200">{typeInfo.description}</p>
                            <p className="text-xs text-slate-300 italic">{typeInfo.example}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Templates Panel - Hidden for now until we have more data */}
          {/* <FieldTemplatesPanel onApplyTemplate={handleApplyTemplate} /> */}

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
                draggedFieldId={draggedField || draggedSectionField}
                onDropFieldToSection={async (sectionId, fieldId) => {
                  await onUpdateField(fieldId, { section_id: sectionId });
                  setDraggedField(null);
                  setDraggedSectionField(null);
                }}
                onRemoveFieldFromSection={async (fieldId) => {
                  await onUpdateField(fieldId, { section_id: null });
                }}
                onSectionFieldDragStart={(fieldId) => {
                  setDraggedSectionField(fieldId);
                }}
                onSectionFieldDragEnd={() => {
                  setDraggedSectionField(null);
                }}
                onUpdateField={onUpdateField}
                onReorderFields={onReorderFields}
                organizationId={organizationId}
                onOpenFieldGroupSettings={onOpenFieldGroupSettings}
              />
            </CardContent>
          </Card>

          {/* Fields List */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Form Fields</CardTitle>
                  <ContextualHelp label="Unassigned form fields" side="right">
                    <p>
                      Fields listed here are not assigned to a section yet. Assign them to a section
                      so they appear in the mobile app and preview.
                    </p>
                  </ContextualHelp>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{fieldsNotInSections.length} fields</Badge>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        data-tour-trigger="add-field-popover"
                        className="cursor-pointer"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Field
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end" data-tour="add-field-button">
                      <TooltipProvider>
                        <div className="grid grid-cols-2 gap-2">
                          {FIELD_TYPES.map(({ type, icon: Icon, label }) => {
                            const fieldTypeDescriptions: Record<
                              FieldType,
                              { description: string; example: string }
                            > = {
                              text: {
                                description: "Single-line text input",
                                example: "e.g., Customer name, Vehicle model",
                              },
                              number: {
                                description: "Numeric input for quantities or measurements",
                                example: "e.g., Number of items, Distance in miles",
                              },
                              email: {
                                description: "Email address input with validation",
                                example: "e.g., customer@example.com",
                              },
                              phone: {
                                description: "Phone number input",
                                example: "e.g., (555) 123-4567",
                              },
                              select: {
                                description: "Dropdown menu with predefined options",
                                example: "e.g., Service type: Basic, Premium, Deluxe",
                              },
                              textarea: {
                                description: "Multi-line text input for longer content",
                                example: "e.g., Notes, Comments, Description",
                              },
                              date: {
                                description: "Date picker for selecting a date",
                                example: "e.g., Appointment date, Due date",
                              },
                              time: {
                                description: "Time picker for selecting a time",
                                example: "e.g., Start time, End time",
                              },
                              boolean: {
                                description: "Checkbox for yes/no or true/false values",
                                example: "e.g., Completed, Verified, Approved",
                              },
                              image: {
                                description: "Image upload for photos or documents",
                                example: "e.g., Before/after photos, Damage documentation",
                              },
                              address: {
                                description: "Address input with autocomplete suggestions",
                                example: "e.g., Customer address, Service location",
                              },
                              grouped_breakdown: {
                                description: "Grouped breakdown for itemized lists with quantities",
                                example: "e.g., Services performed with quantities",
                              },
                            };

                            const typeInfo = fieldTypeDescriptions[type];

                            return (
                              <Tooltip key={type}>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenFieldDialog(type)}
                                    className="flex flex-col items-center justify-center gap-1 h-auto py-2 px-1 cursor-pointer"
                                  >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-[10px]">{label}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-medium text-xs">{label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {typeInfo.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground italic">
                                      {typeInfo.example}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent
              className="pt-0 transition-colors"
              onDragOver={(e) => {
                // Allow dropping fields from sections into Form Fields area
                if (draggedSectionField) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.add(
                    "border-2",
                    "border-primary/50",
                    "bg-primary/5",
                    "rounded-lg"
                  );
                }
              }}
              onDragLeave={(e) => {
                // Remove highlight when leaving drop zone
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  e.currentTarget.classList.remove(
                    "border-2",
                    "border-primary/50",
                    "bg-primary/5",
                    "rounded-lg"
                  );
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove(
                  "border-2",
                  "border-primary/50",
                  "bg-primary/5",
                  "rounded-lg"
                );
                // If dropping a field from a section, remove it from the section
                if (draggedSectionField) {
                  await onUpdateField(draggedSectionField, {
                    section_id: null,
                  });
                  setDraggedSectionField(null);
                }
              }}
            >
              <TooltipProvider>
                <div className="space-y-2">
                  {fieldsNotInSections.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <p className="text-sm">No fields yet</p>
                      <p className="text-xs mt-1">
                        Click &quot;Add Field&quot; above to get started
                      </p>
                    </div>
                  ) : (
                    (() => {
                      let previousGroup: string | null = null;

                      // Helper to convert group ID to display name
                      const getGroupDisplayName = (groupId: string): string => {
                        return groupId
                          .split("_")
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(" ");
                      };

                      return fieldsNotInSections.map((field) => {
                        const FieldIcon =
                          FIELD_TYPES.find((t) => t.type === field.field_type)?.icon || Type;
                        const groupId = field.mutually_exclusive_group;
                        const clusterId = field.group_cluster;
                        const showGroupDivider = Boolean(groupId) && groupId !== previousGroup;
                        previousGroup = groupId || null;

                        return (
                          <React.Fragment key={field.id}>
                            {showGroupDivider && groupId && (
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary/80 mt-4">
                                <Layers className="w-3 h-3" />
                                <span>Choose one: {getGroupDisplayName(groupId)}</span>
                                <div className="flex-1 border-t border-dashed border-primary/40" />
                              </div>
                            )}
                            <div
                              draggable
                              onDragStart={() => handleDragStart(field.id)}
                              onDragOver={(e) => handleDragOver(e, field.id)}
                              onDragEnd={handleDragEnd}
                              className={`group flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-all cursor-move ${
                                groupId ? "bg-primary/5 border-primary/50" : "bg-card"
                              } ${draggedField === field.id ? "opacity-50 scale-[0.98]" : ""}`}
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
                                      className="text-[10px] px-1.5 text-white"
                                    >
                                      Required
                                    </Badge>
                                  )}
                                  {field.conditional_logic && (
                                    <Badge variant="outline" className="text-[10px] px-1.5">
                                      Conditional
                                    </Badge>
                                  )}
                                  {field.field_type === "select" &&
                                    field.validation_rules?.allow_multiple && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 text-primary border-primary/40"
                                      >
                                        Multiple
                                      </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  <Badge variant="secondary" className="text-[10px] px-1.5">
                                    {field.field_type}
                                  </Badge>
                                  <span className="font-mono truncate">{field.name}</span>
                                  {!field.section_id && (
                                    <Badge variant="outline" className="text-[10px] px-1.5">
                                      No section
                                    </Badge>
                                  )}
                                  {clusterId && (
                                    <TooltipProvider>
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
                                          Fields sharing a cluster act as one option inside their
                                          exclusive group (e.g., wiped + soaped details).
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {locationRestrictionsMap.get(field.id) &&
                                    locationRestrictionsMap.get(field.id)!.length > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 bg-amber-50 text-amber-700 border-amber-300"
                                      >
                                        <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                        {locationRestrictionsMap.get(field.id)!.length} location
                                        {locationRestrictionsMap.get(field.id)!.length !== 1
                                          ? "s"
                                          : ""}
                                      </Badge>
                                    )}
                                </div>
                              </div>

                              {/* Field Settings Popover */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Popover
                                  onOpenChange={async (open) => {
                                    if (!open) {
                                      // Popover is closing, save location restrictions
                                      const restrictToLocations =
                                        restrictToLocationsMap.get(field.id) || false;
                                      const selectedLocationIds =
                                        locationRestrictionsMap.get(field.id) || [];
                                      const locationIds = restrictToLocations
                                        ? selectedLocationIds
                                        : [];

                                      if (organizationId) {
                                        try {
                                          await supabase.functions.invoke(
                                            "update-field-config-locations",
                                            {
                                              body: {
                                                field_config_id: field.id,
                                                location_ids: locationIds,
                                              },
                                            }
                                          );
                                          // Refresh location restrictions after save
                                          await loadLocationRestrictions(field.id);
                                        } catch (err) {
                                          log.error("Failed to save location restrictions", {
                                            error:
                                              err instanceof Error ? err.message : "Unknown error",
                                            fieldId: field.id,
                                          });
                                        }
                                      }
                                    } else {
                                      // Popover is opening, load location restrictions
                                      loadLocationRestrictions(field.id);
                                    }
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      aria-label={`Field settings for ${field.label}`}
                                    >
                                      <Settings className="w-4 h-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-80 max-h-[70vh] overflow-y-auto"
                                    align="end"
                                  >
                                    <div className="space-y-4">
                                      <h4 className="font-semibold text-sm">Field Settings</h4>

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
                                        <Label className="text-xs">Description / Placeholder</Label>
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
                                              handleOptionsChange(field.id, e.target.value)
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
                                              <SelectItem value="none">No section</SelectItem>
                                              {sections.map((section) => (
                                                <SelectItem key={section.id} value={section.id}>
                                                  {section.title}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                      {/* Required Toggle */}
                                      <div className="flex items-center justify-between">
                                        <Label className="text-xs">Required Field</Label>
                                        <Switch
                                          checked={field.required}
                                          onCheckedChange={(checked: boolean) =>
                                            handleUpdateField(field.id, {
                                              required: checked,
                                            })
                                          }
                                          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                                        />
                                      </div>

                                      {/* Location Restrictions - Only show if using customer locations */}
                                      {settings?.use_predefined_locations && (
                                        <div className="space-y-3 pt-4 border-t">
                                          <div className="flex items-center space-x-2">
                                            <Switch
                                              id={`restrict-locations-${field.id}`}
                                              checked={
                                                restrictToLocationsMap.get(field.id) || false
                                              }
                                              onCheckedChange={(checked) => {
                                                setRestrictToLocationsMap((prev) => {
                                                  const next = new Map(prev);
                                                  next.set(field.id, checked);
                                                  return next;
                                                });
                                                if (!checked) {
                                                  setLocationRestrictionsMap((prev) => {
                                                    const next = new Map(prev);
                                                    next.set(field.id, []);
                                                    return next;
                                                  });
                                                }
                                              }}
                                              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                                            />
                                            <Label
                                              htmlFor={`restrict-locations-${field.id}`}
                                              className="text-xs cursor-pointer"
                                            >
                                              Restrict to specific locations
                                            </Label>
                                          </div>
                                          {restrictToLocationsMap.get(field.id) && (
                                            <div className="pl-6 border-l-2 border-muted">
                                              <LocationRestrictionPicker
                                                locations={locations}
                                                selectedIds={
                                                  locationRestrictionsMap.get(field.id) || []
                                                }
                                                onChange={(ids) => {
                                                  setLocationRestrictionsMap((prev) => {
                                                    const next = new Map(prev);
                                                    next.set(field.id, ids);
                                                    return next;
                                                  });
                                                }}
                                                idPrefix={`visual-location-${field.id}`}
                                                emptyMessage="No locations available"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <p className="text-[11px] text-muted-foreground rounded-lg border p-3 bg-muted/20">
                                        Need this field mutually exclusive with another? Open{" "}
                                        {onOpenFieldGroupSettings ? (
                                          <button
                                            type="button"
                                            className="font-medium text-primary hover:underline cursor-pointer"
                                            onClick={() => onOpenFieldGroupSettings()}
                                          >
                                            Field Group Settings
                                          </button>
                                        ) : (
                                          <span className="font-medium text-primary">
                                            Field Group Settings
                                          </span>
                                        )}{" "}
                                        to configure that.
                                      </p>
                                    </div>
                                  </PopoverContent>
                                </Popover>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive cursor-pointer"
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
        <div className="hidden lg:block w-90 shrink-0 self-start sticky top-0">
          <Card className=" p-6" data-tour="mobile-preview">
            <MobileDevicePreview
              fields={fields}
              sections={sections}
              formTitle="New Entry"
              formDescription="Fill out the form below"
            />
            <div className="mt-4 p-3 rounded-md bg-muted/50 border border-muted">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Fields will not appear in the preview unless they are added
                to a Section.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Field Configuration Dialog */}
      {selectedFieldType && (
        <FieldConfigDialog
          key={fieldDialogSession}
          open={fieldDialogOpen}
          onOpenChange={setFieldDialogOpen}
          fieldType={selectedFieldType}
          sections={sections}
          existingFieldNames={fields.map((f) => f.name)}
          onSave={handleSaveFieldFromDialog}
          organizationId={organizationId}
          onOpenFieldGroupSettings={onOpenFieldGroupSettings}
        />
      )}
    </div>
  );
}
