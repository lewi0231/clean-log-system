"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { FieldConfig } from "@clean-log/shared/types";
import { X } from "lucide-react";
import { useMemo } from "react";

interface FieldRendererProps {
  field: FieldConfig;
  value: string | number | boolean | string[] | undefined;
  onChange: (value: string | number | boolean | string[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Shared field renderer component for dashboard forms
 * Supports all field types including multi-select with badges
 */
export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
}: FieldRendererProps) {
  const renderFieldInput = useMemo(() => {
    switch (field.field_type) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            id={field.id}
            type={field.field_type === "email" ? "email" : "text"}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description || field.label}
            disabled={disabled}
            aria-invalid={!!error}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description || field.label}
            rows={4}
            disabled={disabled}
            aria-invalid={!!error}
          />
        );

      case "number":
        return (
          <Input
            id={field.id}
            type="number"
            value={String(value || "0")}
            onChange={(e) =>
              onChange(
                e.target.value === "" ? 0 : Number(e.target.value) || 0
              )
            }
            placeholder={field.description || field.label}
            disabled={disabled}
            aria-invalid={!!error}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Switch
              id={field.id}
              checked={value === true}
              onCheckedChange={(checked) => onChange(checked)}
              disabled={disabled}
            />
            <Label htmlFor={field.id} className="font-normal">
              {field.label}
            </Label>
          </div>
        );

      case "select": {
        const isMultiSelect = field.validation_rules?.allow_multiple === true;
        const selectedValues = isMultiSelect
          ? (Array.isArray(value) ? value : [])
          : [];
        const singleValue = isMultiSelect ? "" : (value as string) || "";

        // Get available options (not already selected for multi-select)
        const availableOptions = isMultiSelect
          ? field.options?.filter((opt) => !selectedValues.includes(opt)) || []
          : field.options || [];

        const handleSelectChange = (val: string) => {
          if (isMultiSelect) {
            // Add to selected values
            if (val && !selectedValues.includes(val)) {
              onChange([...selectedValues, val]);
            }
          } else {
            onChange(val);
          }
        };

        const handleRemoveOption = (optionToRemove: string) => {
          onChange(selectedValues.filter((opt) => opt !== optionToRemove));
        };

        return (
          <div className="space-y-2">
            <Select
              value={isMultiSelect ? "" : singleValue}
              onValueChange={handleSelectChange}
              disabled={disabled}
            >
              <SelectTrigger id={field.id}>
                <SelectValue
                  placeholder={
                    isMultiSelect
                      ? availableOptions.length > 0
                        ? `Add ${field.label.toLowerCase()}`
                        : "All options selected"
                      : singleValue
                      ? singleValue
                      : `Select ${field.label.toLowerCase()}`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                {isMultiSelect && availableOptions.length === 0 && (
                  <SelectItem value="" disabled>
                    All options selected
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {isMultiSelect && selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedValues.map((selectedOption) => (
                  <Badge
                    key={selectedOption}
                    variant="secondary"
                    className="flex items-center gap-1.5 px-2 py-1"
                  >
                    <span className="text-sm">{selectedOption}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(selectedOption)}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                      aria-label={`Remove ${selectedOption}`}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "date":
        return (
          <Input
            id={field.id}
            type="date"
            value={
              value && typeof value === "string" ? value.split("T")[0] : ""
            }
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
          />
        );

      case "time":
        return (
          <Input
            id={field.id}
            type="time"
            value={
              value && typeof value === "string"
                ? value.includes(":")
                  ? value
                  : ""
                : ""
            }
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
          />
        );

      case "grouped_breakdown":
        return (
          <div className="text-sm text-muted-foreground italic">
            Grouped breakdown fields require complex input. Please use the
            mobile app or job creation dialog.
          </div>
        );

      default:
        return (
          <Input
            id={field.id}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            disabled={disabled}
            aria-invalid={!!error}
          />
        );
    }
  }, [field, value, onChange, error, disabled]);

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-sm font-medium flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {renderFieldInput}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {field.description && !error && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}
