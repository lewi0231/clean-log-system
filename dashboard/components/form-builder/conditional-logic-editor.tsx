"use client";

import { Button } from "@/components/ui/button";
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
import {
  ConditionalLogic,
  ConditionalOperator,
  ConditionalRule,
  FieldConfig,
} from "@clean-log/shared";
import { Plus, Trash2 } from "lucide-react";

interface ConditionalLogicEditorProps {
  field: FieldConfig;
  allFields: FieldConfig[];
  onChange: (logic: ConditionalLogic | null) => void;
}

const OPERATORS: { value: ConditionalOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "has a value" },
  { value: "contains", label: "contains" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
];

const OPERATORS_WITHOUT_VALUE: ConditionalOperator[] = [
  "is_empty",
  "is_not_empty",
];

export function ConditionalLogicEditor({
  field,
  allFields,
  onChange,
}: ConditionalLogicEditorProps) {
  const logic = field.conditional_logic;
  const isEnabled = !!logic;

  // Filter out the current field from options
  const availableFields = allFields.filter((f) => f.id !== field.id);

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        conditions: [
          {
            field_id: availableFields[0]?.id || "",
            operator: "is_not_empty",
          },
        ],
        match_type: "all",
      });
    } else {
      onChange(null);
    }
  };

  const addCondition = () => {
    if (!logic) return;
    onChange({
      ...logic,
      conditions: [
        ...logic.conditions,
        {
          field_id: availableFields[0]?.id || "",
          operator: "is_not_empty",
        },
      ],
    });
  };

  const removeCondition = (index: number) => {
    if (!logic) return;
    const newConditions = logic.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onChange(null);
    } else {
      onChange({
        ...logic,
        conditions: newConditions,
      });
    }
  };

  const updateCondition = (
    index: number,
    updates: Partial<ConditionalRule>
  ) => {
    if (!logic) return;
    const newConditions = logic.conditions.map((c, i) =>
      i === index ? { ...c, ...updates } : c
    );
    onChange({
      ...logic,
      conditions: newConditions,
    });
  };

  const updateMatchType = (matchType: "all" | "any") => {
    if (!logic) return;
    onChange({
      ...logic,
      match_type: matchType,
    });
  };

  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Conditional Visibility</Label>
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
      </div>

      {isEnabled && logic && (
        <div className="space-y-3 pl-1">
          <p className="text-xs text-muted-foreground">Show this field when:</p>

          {logic.conditions.length > 1 && (
            <Select
              value={logic.match_type || "all"}
              onValueChange={(v: string) => updateMatchType(v as "all" | "any")}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ALL conditions are met</SelectItem>
                <SelectItem value="any">ANY condition is met</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="space-y-2">
            {logic.conditions.map((condition, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 bg-muted/50 rounded-md"
              >
                <div className="flex-1 space-y-2">
                  {/* Field selector */}
                  <Select
                    value={condition.field_id}
                    onValueChange={(v: string) =>
                      updateCondition(index, { field_id: v })
                    }
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    {/* Operator selector */}
                    <Select
                      value={condition.operator}
                      onValueChange={(v: string) =>
                        updateCondition(index, {
                          operator: v as ConditionalOperator,
                          // Clear value if switching to valueless operator
                          value: OPERATORS_WITHOUT_VALUE.includes(
                            v as ConditionalOperator
                          )
                            ? undefined
                            : condition.value,
                        })
                      }
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value input (only for operators that need it) */}
                    {!OPERATORS_WITHOUT_VALUE.includes(condition.operator) && (
                      <Input
                        value={String(condition.value || "")}
                        onChange={(e) =>
                          updateCondition(index, { value: e.target.value })
                        }
                        placeholder="Value"
                        className="flex-1 h-8 text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {availableFields.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
              className="w-full h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Condition
            </Button>
          )}

          {availableFields.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Add more fields to create conditions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
