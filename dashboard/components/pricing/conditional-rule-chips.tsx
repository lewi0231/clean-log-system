"use client";

import { Badge } from "@/components/ui/badge";
import type { PricingCondition } from "@/lib/types";
import { actionLabels, operatorLabels } from "./pricing-condition-helpers";

interface ConditionalRuleChipsProps {
  conditions: PricingCondition[];
  fieldLabels: Record<string, string>;
  emptyMessage?: string;
}

export function ConditionalRuleChips({
  conditions,
  fieldLabels,
  emptyMessage = "No conditional rules yet.",
}: ConditionalRuleChipsProps) {
  if (!conditions.length) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((condition) => (
        <Badge key={condition.id} variant="outline" className="gap-1">
          IF {fieldLabels[condition.condition_field_config_id] ?? "Field"}{" "}
          {operatorLabels[condition.operator] ?? condition.operator}{" "}
          {condition.condition_value} → {actionLabels[condition.action_type]}{" "}
          {condition.action_value}
        </Badge>
      ))}
    </div>
  );
}
