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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { log } from "@/lib/logger";
import { fieldConfigSchema } from "@/lib/validations";
import { FieldConfig, FieldType, ValidationRules } from "@clean-log/shared";
import { useEffect, useState } from "react";
import ValidationRulesEditor from "./validation-rules-editor";

const YARD_GROUP_ID = "yard_tracking_method";

type YardPresetId =
  | "yard_boolean"
  | "yard_wiped"
  | "yard_soaped"
  | "yard_number";

const YARD_PRESETS: Array<{
  id: YardPresetId;
  label: string;
  description: string;
  name: string;
  fieldLabel: string;
  fieldType: FieldType;
  groupCluster: string;
  options?: string[];
  validationRules?: ValidationRules | null;
}> = [
  {
    id: "yard_boolean",
    label: "Yard serviced toggle",
    description: "Fast yes/no confirmation for simple yards.",
    name: "yard_serviced_toggle",
    fieldLabel: "Yard Serviced Today?",
    fieldType: "boolean",
    groupCluster: "simple_servicing",
  },
  {
    id: "yard_wiped",
    label: "Cars wiped breakdown",
    description: "Log how many sedans/SUVs/trucks were wiped.",
    name: "cars_wiped_breakdown",
    fieldLabel: "Cars Wiped (breakdown)",
    fieldType: "grouped_breakdown",
    groupCluster: "detailed_tracking",
    options: ["Sedan", "SUV", "Truck"],
  },
  {
    id: "yard_soaped",
    label: "Cars soaped breakdown",
    description: "Track soap counts per vehicle type.",
    name: "cars_soaped_breakdown",
    fieldLabel: "Cars Soaped (breakdown)",
    fieldType: "grouped_breakdown",
    groupCluster: "detailed_tracking",
    options: ["Sedan", "SUV", "Truck"],
  },
  {
    id: "yard_number",
    label: "Specific yard number",
    description: "Capture the lot or yard identifier that was serviced.",
    name: "yard_number_reference",
    fieldLabel: "Specific Yard Number",
    fieldType: "number",
    groupCluster: "yard_number",
    validationRules: {
      min: 0,
    },
  },
];

interface FieldConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (
    fieldConfigData: {
      name: string;
      label: string;
      field_type: FieldType;
      description: string | null;
      required: boolean;
      validation_rules: ValidationRules | null;
      options: string[] | null;
      mutually_exclusive_group: string | null;
      group_cluster: string | null;
    },
    fieldConfigId?: string
  ) => void | Promise<void>;
  fieldConfig?: FieldConfig | null;
}

export default function FieldConfigForm({
  open,
  onOpenChange,
  onSuccess,
  fieldConfig,
}: FieldConfigFormProps) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [validationRules, setValidationRules] =
    useState<ValidationRules | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [optionsInput, setOptionsInput] = useState("");
  const [mutuallyExclusiveGroup, setMutuallyExclusiveGroup] = useState("");
  const [groupCluster, setGroupCluster] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    label?: string;
    field_type?: string;
    options?: string;
    mutually_exclusive_group?: string;
    group_cluster?: string;
  }>({});
  const [selectedPreset, setSelectedPreset] = useState<YardPresetId | "custom">(
    "custom"
  );

  const isEditMode = !!fieldConfig;
  const isSelectField = fieldType === "select";
  const isGroupedBreakdownField = fieldType === "grouped_breakdown";
  const requiresOptions = isSelectField || isGroupedBreakdownField;

  useEffect(() => {
    if (open) {
      if (fieldConfig) {
        setName(fieldConfig.name);
        setLabel(fieldConfig.label);
        setFieldType(fieldConfig.field_type);
        setDescription(fieldConfig.description || "");
        setRequired(fieldConfig.required);
        setValidationRules(fieldConfig.validation_rules);
        setOptions(fieldConfig.options || []);
        setOptionsInput((fieldConfig.options || []).join(", "));
        setMutuallyExclusiveGroup(fieldConfig.mutually_exclusive_group || "");
        setGroupCluster(fieldConfig.group_cluster || "");
        if (fieldConfig.mutually_exclusive_group === YARD_GROUP_ID) {
          const presetMatch = YARD_PRESETS.find(
            (preset) =>
              preset.fieldType === fieldConfig.field_type &&
              preset.groupCluster === (fieldConfig.group_cluster || "")
          );
          setSelectedPreset(presetMatch?.id || "custom");
        } else {
          setSelectedPreset("custom");
        }
      } else {
        setName("");
        setLabel("");
        setFieldType("text");
        setDescription("");
        setRequired(false);
        setValidationRules(null);
        setOptions([]);
        setOptionsInput("");
        setMutuallyExclusiveGroup("");
        setGroupCluster("");
        setSelectedPreset("custom");
      }
      setErrors({});
    }
  }, [open, fieldConfig]);

  const validateInput = () => {
    log.debug("FieldConfigForm: Validating form input");

    const result = fieldConfigSchema.safeParse({
      name,
      label,
      field_type: fieldType,
      description: description || null,
      required,
      validation_rules: validationRules,
      options: requiresOptions ? options : null,
      mutually_exclusive_group: mutuallyExclusiveGroup.trim() || null,
      group_cluster: groupCluster.trim() || null,
    });

    if (!result.success) {
      const fieldErrors: {
        name?: string;
        label?: string;
        field_type?: string;
        options?: string;
        mutually_exclusive_group?: string;
        group_cluster?: string;
      } = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (
          path === "name" ||
          path === "label" ||
          path === "field_type" ||
          path === "options" ||
          path === "mutually_exclusive_group" ||
          path === "group_cluster"
        ) {
          fieldErrors[path] = issue.message;
        }
      });

      log.warn("FieldConfigForm: Form validation failed", {
        errors: fieldErrors,
      });
      setErrors(fieldErrors);
      throw new Error("Validation failed");
    }

    log.debug("FieldConfigForm: Form validation passed");
    setErrors({});
    return result.data;
  };

  const handleSubmit = async () => {
    try {
      log.info("FieldConfigForm: Starting field config submission", {
        isEditMode,
        fieldConfigId: fieldConfig?.id,
      });
      setIsLoading(true);
      setErrors({});

      const validatedData = validateInput();

      // Normalize validated data to ensure undefined becomes null for optional fields
      const normalizedData = {
        ...validatedData,
        mutually_exclusive_group:
          validatedData.mutually_exclusive_group ?? null,
        group_cluster: validatedData.group_cluster ?? null,
      };

      // Reset form
      setName("");
      setLabel("");
      setFieldType("text");
      setDescription("");
      setRequired(false);
      setValidationRules(null);
      setOptions([]);
      setOptionsInput("");
      setMutuallyExclusiveGroup("");
      setGroupCluster("");
      setErrors({});
      onOpenChange(false);
      await onSuccess(normalizedData, fieldConfig?.id);
    } catch (error) {
      if (error instanceof Error && error.message !== "Validation failed") {
        log.error("FieldConfigForm: Submission failed", {
          error: error.message,
        });
        setErrors({
          name: error.message.includes("name") ? error.message : undefined,
          label: error.message.includes("label") ? error.message : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionsChange = (value: string) => {
    setOptionsInput(value);
    const newOptions = value
      .split(",")
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);
    setOptions(newOptions);
  };

  const applyPreset = (presetId: YardPresetId | "custom") => {
    setSelectedPreset(presetId);

    if (presetId === "custom") {
      setMutuallyExclusiveGroup("");
      setGroupCluster("");
      return;
    }

    const preset = YARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setName(preset.name);
    setLabel(preset.fieldLabel);
    setDescription(preset.description);
    setFieldType(preset.fieldType);
    setMutuallyExclusiveGroup(YARD_GROUP_ID);
    setGroupCluster(preset.groupCluster);
    setOptions(preset.options || []);
    setOptionsInput(preset.options ? preset.options.join(", ") : "");
    setValidationRules(
      typeof preset.validationRules !== "undefined"
        ? preset.validationRules
        : null
    );
    setRequired(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? "Edit Field Configuration"
              : "Add Field Configuration"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update field configuration for the mobile app."
              : "Add a new field configuration for the mobile app."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Internal)</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="field_name"
                aria-invalid={!!errors.name}
                disabled={isEditMode}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and underscores only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label (Display)</Label>
              <Input
                id="label"
                name="label"
                type="text"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (errors.label) {
                    setErrors((prev) => ({ ...prev, label: undefined }));
                  }
                }}
                placeholder="Field Label"
                aria-invalid={!!errors.label}
                required
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field_type">Field Type</Label>
            <Select
              value={fieldType}
              onValueChange={(value) => {
                setFieldType(value as FieldType);
                if (value !== "select" && value !== "grouped_breakdown") {
                  setOptions([]);
                  setOptionsInput("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="textarea">Textarea</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="time">Time</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="grouped_breakdown">
                  Grouped Breakdown
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
            <div className="flex flex-col gap-1">
              <Label className="text-sm">
                Yard Tracking Presets (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Quickly wire the boolean / grouped breakdown / number trio into{" "}
                <code>{YARD_GROUP_ID}</code>. Presets follow{" "}
                <a
                  href="https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/radio-button"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Microsoft&apos;s mutually exclusive recommendations
                </a>{" "}
                so crews choose one yard tracking method per entry.
              </p>
            </div>
            <RadioGroup
              value={selectedPreset}
              onValueChange={(value) =>
                applyPreset(value as YardPresetId | "custom")
              }
              className="grid gap-2 md:grid-cols-2"
            >
              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="custom" id="yard-preset-custom" />
                  <div className="space-y-1">
                    <Label htmlFor="yard-preset-custom" className="text-sm">
                      Custom configuration
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Start from scratch. Set mutually exclusive values manually
                      if needed.
                    </p>
                  </div>
                </div>
              </div>
              {YARD_PRESETS.map((preset) => {
                const inputId = `yard-preset-${preset.id}`;
                return (
                  <div
                    key={preset.id}
                    className="rounded-md border bg-background px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value={preset.id} id={inputId} />
                      <div className="space-y-1">
                        <Label htmlFor={inputId} className="text-sm">
                          {preset.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {preset.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Sets {preset.fieldLabel} in{" "}
                          <code>{YARD_GROUP_ID}</code> ({preset.groupCluster})
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Field description for users"
              rows={2}
            />
          </div>

          {requiresOptions && (
            <div className="space-y-2">
              <Label htmlFor="options">
                {isGroupedBreakdownField
                  ? "Groups (Comma-separated)"
                  : "Options (Comma-separated)"}
              </Label>
              <Input
                id="options"
                name="options"
                type="text"
                value={optionsInput}
                onChange={(e) => handleOptionsChange(e.target.value)}
                placeholder={
                  isGroupedBreakdownField
                    ? "Group 1, Group 2, Group 3"
                    : "Option 1, Option 2, Option 3"
                }
                aria-invalid={!!errors.options}
              />
              {errors.options && (
                <p className="text-sm text-destructive">{errors.options}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {isGroupedBreakdownField
                  ? "Separate multiple groups with commas (e.g., brand names)"
                  : "Separate multiple options with commas"}
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="required"
              checked={required}
              onCheckedChange={setRequired}
            />
            <Label htmlFor="required" className="cursor-pointer">
              Required field
            </Label>
          </div>

          <ValidationRulesEditor
            fieldType={fieldType}
            validationRules={validationRules}
            onChange={setValidationRules}
          />

          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="mutually_exclusive_group">
                Mutually Exclusive Group (Optional)
              </Label>
              <Input
                id="mutually_exclusive_group"
                name="mutually_exclusive_group"
                type="text"
                value={mutuallyExclusiveGroup}
                onChange={(e) => {
                  setMutuallyExclusiveGroup(e.target.value);
                  if (!e.target.value.trim()) {
                    setGroupCluster("");
                  }
                  if (errors.mutually_exclusive_group) {
                    setErrors((prev) => ({
                      ...prev,
                      mutually_exclusive_group: undefined,
                    }));
                  }
                }}
                placeholder="yard_tracking_method"
                aria-invalid={!!errors.mutually_exclusive_group}
              />
              {errors.mutually_exclusive_group && (
                <p className="text-sm text-destructive">
                  {errors.mutually_exclusive_group}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Fields with the same group are mutually exclusive. Only one
                cluster or field in a group can have values at a time—mirroring{" "}
                <a
                  href="https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/radio-button"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Microsoft&apos;s radio-button guidance
                </a>{" "}
                so choices stay crystal clear.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_cluster">Group Cluster (Optional)</Label>
              <Input
                id="group_cluster"
                name="group_cluster"
                type="text"
                value={groupCluster}
                onChange={(e) => {
                  setGroupCluster(e.target.value);
                  if (errors.group_cluster) {
                    setErrors((prev) => ({
                      ...prev,
                      group_cluster: undefined,
                    }));
                  }
                }}
                placeholder="soap_and_wipe_pair"
                disabled={!mutuallyExclusiveGroup.trim()}
                aria-invalid={!!errors.group_cluster}
              />
              {errors.group_cluster && (
                <p className="text-sm text-destructive">
                  {errors.group_cluster}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Fields with the same cluster work together as a single option
                inside the mutually exclusive group. Think “cars wiped” + “cars
                soaped” acting as one choice when crews log a yard.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : isEditMode ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
