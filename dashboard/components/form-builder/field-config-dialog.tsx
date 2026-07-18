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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LocationRestrictionPicker } from "@/components/form-builder/location-restriction-picker";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import {
  type FieldConfig,
  type FieldType,
  type FormSectionWithFields,
  type ValidationRules,
} from "@clean-log/shared";
import { Settings, Shield, Sliders } from "lucide-react";
import { useRef, useState } from "react";

interface FieldConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldType: FieldType;
  sections: FormSectionWithFields[];
  existingFieldNames: string[];
  onSave: (
    field: Omit<
      FieldConfig,
      "id" | "organization_id" | "version" | "active" | "archived_at" | "created_at" | "updated_at"
    >
  ) => Promise<void>;
  organizationId: string | null;
  onOpenFieldGroupSettings?: () => void;
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

/** Placeholder hints per type — label starts empty; user types with this as a guide. */
const LABEL_PLACEHOLDERS: Record<FieldType, string> = {
  text: "e.g. Customer name",
  number: "e.g. Total vehicles",
  email: "e.g. Contact email",
  phone: "e.g. Site phone",
  select: "e.g. Service type",
  textarea: "e.g. Notes",
  date: "e.g. Service date",
  time: "e.g. Finish time",
  boolean: "e.g. Job completed",
  image: "e.g. Site photo",
  address: "e.g. Service address",
  grouped_breakdown: "e.g. Services performed",
};

function generateFieldNameFromLabel(labelText: string, existingFieldNames: string[]): string {
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
}

function buildValidationRules(
  fieldType: FieldType,
  allowMultiple: boolean,
  extra: Partial<ValidationRules>
): ValidationRules | null {
  const r: ValidationRules = { ...extra };
  if (fieldType === "select" && allowMultiple) {
    r.allow_multiple = true;
  }
  // Drop empty / meaningless entries
  const cleaned: ValidationRules = {};
  (Object.entries(r) as [keyof ValidationRules, unknown][]).forEach(([key, val]) => {
    if (val === undefined || val === null) return;
    if (typeof val === "string" && val.trim() === "") return;
    if (typeof val === "number" && Number.isNaN(val)) return;
    (cleaned as Record<string, unknown>)[key as string] = val;
  });
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

export function FieldConfigDialog({
  open,
  onOpenChange,
  fieldType,
  sections,
  existingFieldNames,
  onSave,
  organizationId,
  onOpenFieldGroupSettings,
}: FieldConfigDialogProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [sectionId, setSectionId] = useState<string>("none");
  const [options, setOptions] = useState<string>(() =>
    fieldType === "select" || fieldType === "grouped_breakdown" ? "Option 1, Option 2" : ""
  );
  const [restrictToLocations, setRestrictToLocations] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [validationExtra, setValidationExtra] = useState<Partial<ValidationRules>>({});
  const nameManuallyEditedRef = useRef(false);

  const { locations } = useLocations();
  const { settings } = useOrganizationSettings();

  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (nameManuallyEditedRef.current) return;
    if (!value.trim()) {
      setName("");
      return;
    }
    setName(generateFieldNameFromLabel(value, existingFieldNames));
  };

  const handleSave = async () => {
    if (!label.trim() || !name.trim()) return;

    const savedName = name.trim();
    const savedRestrictToLocations = restrictToLocations;
    const savedLocationIds = [...selectedLocationIds];

    const validation_rules = buildValidationRules(fieldType, allowMultiple, validationExtra);

    try {
      await onSave({
        name: savedName,
        label: label.trim(),
        field_type: fieldType,
        description: description.trim() || null,
        required,
        order_position: 0,
        validation_rules,
        options:
          (fieldType === "select" || fieldType === "grouped_breakdown") && options.trim()
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

      if (savedRestrictToLocations && savedLocationIds.length > 0 && organizationId) {
        setTimeout(async () => {
          try {
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
                (fc: FieldConfig) => fc.name === savedName
              );

              if (newFieldConfig?.id) {
                const { error: locationError } = await supabase.functions.invoke(
                  "update-field-config-locations",
                  {
                    body: {
                      field_config_id: newFieldConfig.id,
                      location_ids: savedLocationIds,
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
              fieldName: savedName,
            });
          }
        }, 500);
      }
    } catch (err) {
      log.error("Failed to create field", {
        error: err instanceof Error ? err.message : "Unknown error",
        fieldName: savedName,
      });
    }
  };

  const generalBlock = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="field-label">
          Label <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field-label"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={LABEL_PLACEHOLDERS[fieldType]}
          autoFocus
          className={!label ? "ring-2 ring-primary/15 ring-offset-2" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Field names below are generated from the label for consistency; you can change the
          internal name if needed.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-name">
          Field name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            nameManuallyEditedRef.current = true;
          }}
          placeholder="field_name"
          className="font-mono ring-primary/15 ring-offset-2 ring-2"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-description">Description / placeholder</Label>
        <Textarea
          id="field-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional helper text shown in the app"
          rows={2}
          className="ring-primary/15 ring-offset-2 ring-2"
        />
      </div>

      {sections.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="field-section">Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger id="field-section" className="ring-primary/15 ring-offset-2 ring-2">
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
            Comma-separated values for the dropdown or grouped list.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30  ring-primary/15 ring-offset-2 ring-2">
        <div className="space-y-0.5">
          <Label htmlFor="field-required">Required for submission</Label>
          <p className="text-xs text-muted-foreground">
            Workers must complete this field before submitting the job.
          </p>
        </div>
        <Switch
          id="field-required"
          checked={required}
          onCheckedChange={setRequired}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30 ring-primary/15 ring-offset-2 ring-2"
        />
      </div>

      {settings?.use_predefined_locations && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/20  ring-primary/15 ring-offset-2 ring-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="restrict-to-locations"
              checked={restrictToLocations}
              onCheckedChange={setRestrictToLocations}
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30 "
            />
            <Label htmlFor="restrict-to-locations" className="cursor-pointer font-medium">
              Restrict to specific locations
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Limit this field to certain customer locations. Leave off to use at all locations.
          </p>

          {restrictToLocations && (
            <LocationRestrictionPicker
              locations={locations}
              selectedIds={selectedLocationIds}
              onChange={setSelectedLocationIds}
              idPrefix="dialog-location"
            />
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground rounded-lg border p-3 bg-muted/20">
        Need this field to be mutually exclusive with another? Configure that in{" "}
        {onOpenFieldGroupSettings ? (
          <button
            type="button"
            className="font-medium text-primary hover:underline cursor-pointer"
            onClick={() => {
              onOpenChange(false);
              onOpenFieldGroupSettings();
            }}
          >
            Field Group Settings
          </button>
        ) : (
          <span className="font-medium text-primary">Field Group Settings</span>
        )}
        .
      </p>
    </div>
  );

  const validationBlock = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optional limits enforced when workers submit. Behaviour depends on field type in the mobile
        app.
      </p>

      {fieldType === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="val-min">Minimum</Label>
            <Input
              id="val-min"
              type="number"
              value={validationExtra.min ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setValidationExtra((prev) => ({
                  ...prev,
                  min: v === "" ? undefined : Number(v),
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="val-max">Maximum</Label>
            <Input
              id="val-max"
              type="number"
              value={validationExtra.max ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setValidationExtra((prev) => ({
                  ...prev,
                  max: v === "" ? undefined : Number(v),
                }));
              }}
            />
          </div>
        </div>
      )}

      {["text", "textarea", "email", "phone", "address"].includes(fieldType) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="val-min-len">Min length</Label>
            <Input
              id="val-min-len"
              type="number"
              min={0}
              value={validationExtra.minLength ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setValidationExtra((prev) => ({
                  ...prev,
                  minLength: v === "" ? undefined : parseInt(v, 10),
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="val-max-len">Max length</Label>
            <Input
              id="val-max-len"
              type="number"
              min={0}
              value={validationExtra.maxLength ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setValidationExtra((prev) => ({
                  ...prev,
                  maxLength: v === "" ? undefined : parseInt(v, 10),
                }));
              }}
            />
          </div>
        </div>
      )}

      {["text", "textarea"].includes(fieldType) && (
        <div className="space-y-2">
          <Label htmlFor="val-pattern">Pattern (regex)</Label>
          <Input
            id="val-pattern"
            value={validationExtra.pattern ?? ""}
            onChange={(e) =>
              setValidationExtra((prev) => ({
                ...prev,
                pattern: e.target.value || undefined,
              }))
            }
            placeholder="^[A-Z]{3}[0-9]+$"
            className="font-mono text-sm"
          />
        </div>
      )}

      {fieldType === "grouped_breakdown" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="val-min-items">Min items</Label>
            <Input
              id="val-min-items"
              type="number"
              min={0}
              value={validationExtra.min_items ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setValidationExtra((prev) => ({
                  ...prev,
                  min_items: v === "" ? undefined : parseInt(v, 10),
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="val-max-items">Max items</Label>
            <Input
              id="val-max-items"
              type="number"
              min={0}
              value={validationExtra.max_items ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setValidationExtra((prev) => ({
                  ...prev,
                  max_items: v === "" ? undefined : parseInt(v, 10),
                }));
              }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="val-custom-msg">Custom error message</Label>
        <Input
          id="val-custom-msg"
          value={validationExtra.customMessage ?? ""}
          onChange={(e) =>
            setValidationExtra((prev) => ({
              ...prev,
              customMessage: e.target.value || undefined,
            }))
          }
          placeholder="Shown when validation fails"
        />
      </div>
    </div>
  );

  const advancedBlock = (
    <div className="space-y-4">
      {fieldType === "select" && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="field-allow-multiple">Allow multiple selections</Label>
            <p className="text-xs text-muted-foreground">
              Workers can pick more than one option where the mobile UI supports it.
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
      {fieldType === "grouped_breakdown" && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="allow-zero-qty">Allow zero quantities</Label>
            <p className="text-xs text-muted-foreground">
              Allow line items with a quantity of zero.
            </p>
          </div>
          <Switch
            id="allow-zero-qty"
            checked={validationExtra.allow_zero_quantities ?? false}
            onCheckedChange={(checked) =>
              setValidationExtra((prev) => ({
                ...prev,
                allow_zero_quantities: checked,
              }))
            }
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
          />
        </div>
      )}
      {fieldType !== "select" && fieldType !== "grouped_breakdown" && (
        <p className="text-sm text-muted-foreground">No extra options for this field type yet.</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {FIELD_TYPE_LABELS[fieldType]} field</DialogTitle>
          <DialogDescription>
            Configure properties for this field. The internal field name is derived from the label
            unless you change it.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex flex-col gap-4 sm:flex-row sm:items-start"
        >
          <TabsList className="flex h-auto w-full flex-col items-stretch justify-start rounded-lg bg-muted p-1 sm:w-44 sm:shrink-0 gap-1">
            <TabsTrigger value="general" className="justify-start gap-2 cursor-pointer">
              <Settings className="h-4 w-4 shrink-0" />
              General
            </TabsTrigger>
            <TabsTrigger value="validation" className="justify-start gap-2 cursor-pointer">
              <Shield className="h-4 w-4 shrink-0" />
              Validation
            </TabsTrigger>
            <TabsTrigger value="advanced" className="justify-start gap-2 cursor-pointer">
              <Sliders className="h-4 w-4 shrink-0" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <div className="min-w-0 flex-1 space-y-1">
            <TabsContent value="general" className="mt-0 space-y-0">
              {generalBlock}
            </TabsContent>
            <TabsContent value="validation" className="mt-0 space-y-0">
              {validationBlock}
            </TabsContent>
            <TabsContent value="advanced" className="mt-0 space-y-0">
              {advancedBlock}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!label.trim() || !name.trim()}
            className="cursor-pointer"
          >
            Add field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
