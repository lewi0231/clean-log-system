"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { log } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AutoSaveInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
> {
  label?: string;
  value: string | null;
  onSave: (value: string) => Promise<void>;
  debounceMs?: number;
  required?: boolean;
  description?: string;
  normalizeValue?: (value: string) => string;
  className?: string;
}

/**
 * AutoSaveInput - A reusable input component with debounced auto-save
 *
 * Features:
 * - Debounced auto-save after typing stops
 * - Immediate save on blur
 * - Visual saving indicator
 * - Handles null/undefined values gracefully
 * - Optional value normalization
 */
export function AutoSaveInput({
  label,
  value,
  onSave,
  debounceMs = 1000,
  required = false,
  description,
  normalizeValue = (val) => val.trim(),
  className,
  id,
  ...inputProps
}: AutoSaveInputProps) {
  const [localValue, setLocalValue] = useState<string>(value || "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Sync local value with prop value (but only if user isn't actively editing)
  useEffect(() => {
    // Skip on initial mount to preserve local state
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only sync if there are no unsaved changes
    if (!hasUnsavedChanges) {
      setLocalValue(value || "");
    }
  }, [value, hasUnsavedChanges]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const performSave = async (valueToSave: string) => {
    const normalizedValue = normalizeValue(valueToSave);
    const currentValue = normalizeValue(value || "");

    // Don't save if value hasn't changed
    if (normalizedValue === currentValue) {
      setHasUnsavedChanges(false);
      return;
    }

    // Don't save empty values for required fields
    if (required && !normalizedValue) {
      setHasUnsavedChanges(false);
      return;
    }

    setIsSaving(true);
    setHasUnsavedChanges(false);

    try {
      await onSave(normalizedValue);
    } catch (error) {
      // On error, restore the value and mark as having unsaved changes
      setLocalValue(value || "");
      setHasUnsavedChanges(false);
      log.error("Failed to save input value:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setHasUnsavedChanges(true);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set up debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performSave(newValue);
    }, debounceMs);
  };

  const handleBlur = async () => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Save immediately on blur if there are unsaved changes
    if (hasUnsavedChanges) {
      await performSave(localValue);
    }
  };

  const inputId = id || `auto-save-input-${label?.toLowerCase().replace(/\s+/g, "-") || "input"}`;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={inputId} className="flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </Label>
      )}
      <Input
        id={inputId}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={isSaving}
        aria-invalid={hasUnsavedChanges && required && !localValue.trim()}
        {...inputProps}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
