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
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  FieldConfig,
  FieldType,
  FormSectionWithFields,
} from "@clean-log/shared";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  image: "Image",
  address: "Address",
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
  const [restrictToLocations, setRestrictToLocations] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const nameManuallyEditedRef = useRef(false);

  const { locations } = useLocations();
  const { organizationId } = useOrganization();
  const { settings } = useOrganizationSettings();

  // Update name when label changes (only if not manually edited)
  useEffect(() => {
    if (label && !nameManuallyEditedRef.current) {
      // Generate field name from label
      const generateFieldName = (labelText: string): string => {
        const baseName = labelText
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");

        let generatedName = baseName;
        let counter = 1;

        // Use current existingFieldNames via closure
        while (existingFieldNames.includes(generatedName)) {
          generatedName = `${baseName}_${counter}`;
          counter++;
        }

        return generatedName;
      };

      const generatedName = generateFieldName(label);
      setName(generatedName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

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
      setRestrictToLocations(false);
      setSelectedLocationIds([]);
      setAllowMultiple(false);
      // Reset manual edit flag when dialog opens
      nameManuallyEditedRef.current = false;
    }
  }, [open, fieldType]);

  const handleSave = async () => {
    if (!label.trim() || !name.trim()) return;

    setSaving(true);
    try {
      // Save the field first
      await onSave({
        name: name.trim(),
        label: label.trim(),
        field_type: fieldType,
        description: description.trim() || null,
        required,
        order_position: 0, // Will be set by the parent
        validation_rules:
          fieldType === "select" && allowMultiple
            ? { allow_multiple: true }
            : null,
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

      // Save location restrictions after field is created
      // We need to find the newly created field config by name
      if (
        restrictToLocations &&
        selectedLocationIds.length > 0 &&
        organizationId
      ) {
        try {
          // Wait a bit for the field config to be created
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Fetch field configs to find the newly created one
          const { data, error: fetchError } = await supabase.functions.invoke(
            "list-field-configs",
            {
              body: {
                organization_id: organizationId,
              },
            }
          );

          if (!fetchError && data?.field_configs) {
            const newFieldConfig = data.field_configs.find(
              (fc: FieldConfig) => fc.name === name.trim()
            );

            if (newFieldConfig?.id) {
              const { error: locationError } = await supabase.functions.invoke(
                "update-field-config-locations",
                {
                  body: {
                    field_config_id: newFieldConfig.id,
                    location_ids: selectedLocationIds,
                  },
                }
              );

              if (locationError) {
                log.error("Failed to save location restrictions", {
                  error: locationError.message || "Unknown error",
                  fieldId: newFieldConfig?.id,
                });
              }
            }
          }
        } catch (err) {
          log.error("Failed to save location restrictions", {
            error: err instanceof Error ? err.message : "Unknown error",
            fieldName: name,
          });
        }
      }

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
              onChange={(e) => {
                setName(e.target.value);
                // Mark as manually edited when user types
                nameManuallyEditedRef.current = true;
              }}
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
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
            />
          </div>

          {/* Allow Multiple Selections - Only for select fields */}
          {fieldType === "select" && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="field-allow-multiple">
                  Allow Multiple Selections
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable users to select multiple options from this list. The
                  mobile app will handle the UI implementation.
                </p>
              </div>
              <Switch
                id="field-allow-multiple"
                checked={allowMultiple}
                onCheckedChange={setAllowMultiple}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
              />
            </div>
          )}

          {/* Location Restrictions - Only show if using customer locations */}
          {settings?.use_predefined_locations && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Switch
                  id="restrict-to-locations"
                  checked={restrictToLocations}
                  onCheckedChange={setRestrictToLocations}
                />
                <Label
                  htmlFor="restrict-to-locations"
                  className="cursor-pointer"
                >
                  Restrict to specific locations
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, this field will only be available at the selected
                locations. Leave empty to make it available at all locations.
              </p>

              {restrictToLocations && (
                <div className="space-y-2">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No locations available. Create locations first.
                    </p>
                  ) : (
                    <div className="rounded-md border border-input bg-transparent shadow-sm">
                      <div className="max-h-48 overflow-y-auto p-2">
                        {locations
                          .filter((loc) => loc.active)
                          .map((location) => {
                            const isSelected = selectedLocationIds.includes(
                              location.id
                            );
                            return (
                              <div
                                key={location.id}
                                className={cn(
                                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                  isSelected && "bg-accent/50"
                                )}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedLocationIds(
                                      selectedLocationIds.filter(
                                        (id) => id !== location.id
                                      )
                                    );
                                  } else {
                                    setSelectedLocationIds([
                                      ...selectedLocationIds,
                                      location.id,
                                    ]);
                                  }
                                }}
                              >
                                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                  {isSelected && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </span>
                                <Label
                                  htmlFor={`dialog-location-${location.id}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {location.name}
                                </Label>
                                <input
                                  type="checkbox"
                                  id={`dialog-location-${location.id}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedLocationIds([
                                        ...selectedLocationIds,
                                        location.id,
                                      ]);
                                    } else {
                                      setSelectedLocationIds(
                                        selectedLocationIds.filter(
                                          (id) => id !== location.id
                                        )
                                      );
                                    }
                                  }}
                                  className="sr-only"
                                  aria-hidden="true"
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
