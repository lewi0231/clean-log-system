"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldType, ValidationRules } from "@/lib/types";
import { useEffect, useState } from "react";

interface ValidationRulesEditorProps {
  fieldType: FieldType;
  validationRules: ValidationRules | null;
  onChange: (rules: ValidationRules | null) => void;
}

export default function ValidationRulesEditor({
  fieldType,
  validationRules,
  onChange,
}: ValidationRulesEditorProps) {
  const [rules, setRules] = useState<ValidationRules>(validationRules || {});

  useEffect(() => {
    const updateValidationRules = async () => {
      setRules(validationRules || {});
    };
    updateValidationRules();
  }, [validationRules]);

  const updateRule = (
    key: keyof ValidationRules,
    value: number | string | undefined
  ) => {
    const newRules = { ...rules };
    if (value === undefined || value === "") {
      delete newRules[key];
    } else {
      newRules[key] = value as never;
    }
    setRules(newRules);
    onChange(Object.keys(newRules).length > 0 ? newRules : null);
  };

  const isTextBased = ["text", "email", "phone", "textarea"].includes(
    fieldType
  );
  const isNumberBased = fieldType === "number";

  if (!isTextBased && !isNumberBased) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Validation Rules</div>

      {isTextBased && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minLength">Min Length</Label>
              <Input
                id="minLength"
                type="number"
                min="0"
                value={rules.minLength ?? ""}
                onChange={(e) =>
                  updateRule(
                    "minLength",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLength">Max Length</Label>
              <Input
                id="maxLength"
                type="number"
                min="1"
                value={rules.maxLength ?? ""}
                onChange={(e) =>
                  updateRule(
                    "maxLength",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pattern">Pattern (Regex)</Label>
            <Input
              id="pattern"
              type="text"
              value={rules.pattern ?? ""}
              onChange={(e) =>
                updateRule("pattern", e.target.value || undefined)
              }
              placeholder="Optional regex pattern"
            />
          </div>
        </>
      )}

      {isNumberBased && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min">Min Value</Label>
            <Input
              id="min"
              type="number"
              value={rules.min ?? ""}
              onChange={(e) =>
                updateRule(
                  "min",
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Max Value</Label>
            <Input
              id="max"
              type="number"
              value={rules.max ?? ""}
              onChange={(e) =>
                updateRule(
                  "max",
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              placeholder="Optional"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="customMessage">Custom Error Message</Label>
        <Input
          id="customMessage"
          type="text"
          value={rules.customMessage ?? ""}
          onChange={(e) =>
            updateRule("customMessage", e.target.value || undefined)
          }
          placeholder="Optional custom validation message"
        />
      </div>
    </div>
  );
}
