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
import type { PricingCondition } from "@/lib/types";
import type { FieldConfig } from "@clean-log/shared";
import { useState } from "react";
import { actionLabels, operatorLabels } from "./pricing-condition-helpers";

export interface ConditionalRuleDraft {
  condition_field_config_id: string;
  operator: PricingCondition["operator"];
  condition_value: string;
  action_type: PricingCondition["action_type"];
  action_value: number;
}

interface ConditionalRuleBuilderProps {
  fieldOptions: FieldConfig[];
  disabled?: boolean;
  saving?: boolean;
  onSubmit: (draft: ConditionalRuleDraft) => Promise<void>;
  error?: string | null;
  title?: string;
  description?: string;
}

const defaultState: ConditionalRuleDraft = {
  condition_field_config_id: "",
  operator: "greater_than",
  condition_value: "",
  action_type: "add",
  action_value: 1,
};

export function ConditionalRuleBuilder({
  fieldOptions,
  disabled,
  saving,
  onSubmit,
  error,
  title = "Add conditional adjustment",
  description = "Choose a trigger field, comparison, and adjustment.",
}: ConditionalRuleBuilderProps) {
  const [formState, setFormState] =
    useState<ConditionalRuleDraft>(defaultState);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formState.condition_field_config_id) {
      setLocalError("Select a trigger field.");
      return;
    }

    if (formState.condition_value.trim() === "") {
      setLocalError("Enter a comparison value.");
      return;
    }

    const nextDraft = {
      ...formState,
      action_value: Number(formState.action_value),
    };

    if (isNaN(nextDraft.action_value)) {
      setLocalError("Enter a numeric adjustment value.");
      return;
    }

    setLocalError(null);
    await onSubmit(nextDraft);
    setFormState(defaultState);
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Trigger field</Label>
          <Select
            value={formState.condition_field_config_id}
            onValueChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                condition_field_config_id: value,
              }))
            }
            disabled={disabled || saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a field" />
            </SelectTrigger>
            <SelectContent>
              {fieldOptions.map((fc) => (
                <SelectItem key={fc.id} value={fc.id}>
                  {fc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Operator</Label>
          <Select
            value={formState.operator}
            onValueChange={(value: PricingCondition["operator"]) =>
              setFormState((prev) => ({ ...prev, operator: value }))
            }
            disabled={disabled || saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(operatorLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Compare value</Label>
          <Input
            value={formState.condition_value}
            onChange={(e) =>
              setFormState((prev) => ({
                ...prev,
                condition_value: e.target.value,
              }))
            }
            disabled={disabled || saving}
            placeholder="e.g. 5"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Adjustment</Label>
          <Select
            value={formState.action_type}
            onValueChange={(value: PricingCondition["action_type"]) =>
              setFormState((prev) => ({ ...prev, action_type: value }))
            }
            disabled={disabled || saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(actionLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Adjustment value</Label>
        <Input
          value={formState.action_value.toString()}
          onChange={(e) =>
            setFormState((prev) => ({
              ...prev,
              action_value: Number(e.target.value),
            }))
          }
          disabled={disabled || saving}
          placeholder="e.g. 3"
        />
      </div>
      {(localError || error) && (
        <p className="text-xs text-destructive">{localError || error}</p>
      )}
      <Button onClick={handleSubmit} disabled={disabled || saving}>
        {saving ? "Adding..." : "Add rule"}
      </Button>
    </div>
  );
}
