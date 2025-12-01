"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldConfig, FormSectionWithFields } from "@clean-log/shared";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

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
}

interface SectionFormData {
  title: string;
  description: string;
  collapsed_by_default: boolean;
}

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
  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields]
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

    const draggedIndex = sections.findIndex((s) => s.id === draggedSection);
    const targetIndex = sections.findIndex((s) => s.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const newOrder = [...sections];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    onReorderSections(newOrder.map((s) => s.id));
  };

  const handleFieldDrop = (e: React.DragEvent, sectionId: string) => {
    if (!draggedFieldId || !onDropFieldToSection) return;
    e.preventDefault();
    e.stopPropagation();
    onDropFieldToSection(sectionId, draggedFieldId);
  };

  const handleDragEnd = () => {
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
          <p className="text-xs">Add sections to organize your form fields</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section) => {
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
                        {sectionFields.map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-foreground group"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {field.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {field.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[11px]">
                                {field.field_type}
                              </Badge>
                              {onRemoveFieldFromSection && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                  onClick={() =>
                                    onRemoveFieldFromSection(field.id)
                                  }
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
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
                : "Create a new section to organize your form fields"}
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
