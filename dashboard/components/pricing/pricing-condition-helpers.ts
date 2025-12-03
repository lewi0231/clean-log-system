import type { PricingCondition } from "@/lib/types";

export const operatorLabels: Record<PricingCondition["operator"], string> = {
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  greater_than_or_equal: "≥",
  less_than: "<",
  less_than_or_equal: "≤",
  contains: "contains",
};

export const actionLabels: Record<PricingCondition["action_type"], string> = {
  add: "+ amount",
  subtract: "− amount",
  multiply: "× amount",
  divide: "÷ amount",
  set: "set price",
};

export function serializeCondition(condition: PricingCondition) {
  return {
    condition_field_config_id: condition.condition_field_config_id,
    operator: condition.operator,
    condition_value: condition.condition_value,
    action_type: condition.action_type,
    action_value: condition.action_value,
    metadata: condition.metadata ?? undefined,
    priority: condition.priority,
  };
}
