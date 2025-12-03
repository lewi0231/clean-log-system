"use client";

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
import { useEffect, useState } from "react";

interface FieldConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldType: FieldType;
  sections: FormSectionWithFields[];
  existingFieldNames: string[];
  onSave: (
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
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  email: "Email",
  phone: "Phone",
  select: "Select",
  textarea: "Text Area",
  date: "Date",
  time: "Time",
  boolean: "Checkbox",
  grouped_breakdown: "Grouped Breakdown",
};

export function FieldConfigDialog({
  open,
  onOpenChange,
  fieldType,
  sections,
  existingFieldNames,
  onSave,
}: FieldConfigDialogProps) {
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [sectionId, setSectionId] = useState<string>("none");
  const [options, setOptions] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Generate field name from label
  const generateFieldName = (labelText: string): string => {
    const baseName = labelText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    let generatedName = baseName;
    let counter = 1;

    while (existingFieldNames.includes(generatedName)) {
      generatedName = `${baseName}_${counter}`;
      counter++;
    }

    return generatedName;
  };

  // Update name when label changes
  useEffect(() => {
    if (label) {
      const generatedName = generateFieldName(label);
      setName(generatedName);
    }
  }, [label, existingFieldNames]);

  // Reset form when dialog opens/closes or field type changes
  useEffect(() => {
    if (open) {
      const defaultLabel = `New ${FIELD_TYPE_LABELS[fieldType]} Field`;
      setLabel(defaultLabel);
      setDescription("");
      setRequired(false);
      setSectionId("none");
      setOptions(
        fieldType === "select" || fieldType === "grouped_breakdown"
          ? "Option 1, Option 2"
          : ""
      );
    }
  }, [open, fieldType]);

  const handleSave = async () => {
    if (!label.trim() || !name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        label: label.trim(),
        field_type: fieldType,
        description: description.trim() || null,
        required,
        order_position: 0, // Will be set by the parent
        validation_rules: null,
        options:
          (fieldType === "select" || fieldType === "grouped_breakdown") &&
          options.trim()
            ? options
                .split(",")
                .map((o) => o.trim())
                .filter((o) => o.length > 0)
            : null,
        mutually_exclusive_group: null,
        group_cluster: null,
        section_id: sectionId === "none" ? null : sectionId,
        conditional_logic: null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {FIELD_TYPE_LABELS[fieldType]} Field</DialogTitle>
          <DialogDescription>
            Configure the field settings before adding it to your form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="field-label">
              Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter field label"
              autoFocus
            />
          </div>

          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">
              Field Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="field_name"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Used internally. Auto-generated from label but can be customized.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="field-description">Description / Placeholder</Label>
            <Textarea
              id="field-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description or placeholder text"
              rows={2}
            />
          </div>

          {/* Section Assignment */}
          {sections.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="field-section">Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger id="field-section">
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

          {/* Options for select/grouped_breakdown */}
          {(fieldType === "select" || fieldType === "grouped_breakdown") && (
            <div className="space-y-2">
              <Label htmlFor="field-options">
                Options <span className="text-destructive">*</span>
              </Label>
              <Input
                id="field-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
              />
              <p className="text-xs text-muted-foreground">
                Enter options separated by commas
              </p>
            </div>
          )}

          {/* Required Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="field-required">Required Field</Label>
              <p className="text-xs text-muted-foreground">
                Make this field mandatory
              </p>
            </div>
            <Switch
              id="field-required"
              checked={required}
              onCheckedChange={setRequired}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !label.trim() || !name.trim()}
          >
            {saving ? "Adding..." : "Add Field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
