"use client";

/**
 * PricingFieldTypeNav — Sidebar navigation for field types
 *
 * Replaces the inner tabs for Number/Boolean/Select/Group with a
 * visible sidebar (desktop) or horizontal scroll row (mobile).
 *
 * Accessibility: Uses role="radiogroup" with roving tabIndex per S2 §4.2/§11.2.
 *
 * @see S2-pricing-tab-redesign.md §4.2
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckSquare, Hash, Layers, Lightbulb, List } from "lucide-react";
import { useCallback, useId, useRef, type KeyboardEvent } from "react";

export type InnerFieldType =
  | "number-pricing"
  | "boolean-pricing"
  | "select-pricing"
  | "group-pricing";

const FIELD_TYPE_ORDER: InnerFieldType[] = [
  "number-pricing",
  "boolean-pricing",
  "select-pricing",
  "group-pricing",
];

interface FieldTypeConfig {
  type: InnerFieldType;
  label: string;
  icon: typeof Hash;
  iconColorClass: string;
  iconBgClass: string;
}

const FIELD_TYPE_CONFIGS: FieldTypeConfig[] = [
  {
    type: "number-pricing",
    label: "Number",
    icon: Hash,
    iconColorClass: "text-blue-600 dark:text-blue-400",
    iconBgClass: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    type: "boolean-pricing",
    label: "Boolean",
    icon: CheckSquare,
    iconColorClass: "text-green-600 dark:text-green-400",
    iconBgClass: "bg-green-100 dark:bg-green-900/30",
  },
  {
    type: "select-pricing",
    label: "Select",
    icon: List,
    iconColorClass: "text-purple-600 dark:text-purple-400",
    iconBgClass: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    type: "group-pricing",
    label: "Group",
    icon: Layers,
    iconColorClass: "text-orange-600 dark:text-orange-400",
    iconBgClass: "bg-orange-100 dark:bg-orange-900/30",
  },
];

/** Tip content for each field type — Title Case title, sentence case body */
const PRICING_FIELD_TYPE_TIPS: Record<InnerFieldType, { title: string; body: string }> = {
  "number-pricing": {
    title: "Number Fields",
    body: "Price per unit for countable items like windows, panels, or square footage. Workers enter a quantity, and the total is calculated automatically.",
  },
  "boolean-pricing": {
    title: "Boolean Fields",
    body: "Fixed price when a yes/no option is selected, such as premium materials or rush service. The price applies when the field is true.",
  },
  "select-pricing": {
    title: "Select Fields",
    body: "Different prices for dropdown choices like service tiers or vehicle types. Each option can have its own customer price and worker payment.",
  },
  "group-pricing": {
    title: "Group Fields",
    body: "Categorized pricing for grouped items like car makes and models. Set prices for each category within the group.",
  },
};

export interface PricingFieldTypeNavProps {
  value: InnerFieldType;
  onValueChange: (value: InnerFieldType) => void;
  numberCount: number;
  booleanCount: number;
  selectCount: number;
  groupCount: number;
  disabled?: boolean;
  isFixedPricing?: boolean;
}

export function PricingFieldTypeNav({
  value,
  onValueChange,
  numberCount,
  booleanCount,
  selectCount,
  groupCount,
  disabled = false,
  isFixedPricing = false,
}: PricingFieldTypeNavProps) {
  const groupId = useId();
  const itemRefs = useRef<Map<InnerFieldType, HTMLButtonElement>>(new Map());

  const getCounts = useCallback(
    (type: InnerFieldType): number => {
      switch (type) {
        case "number-pricing":
          return numberCount;
        case "boolean-pricing":
          return booleanCount;
        case "select-pricing":
          return selectCount;
        case "group-pricing":
          return groupCount;
      }
    },
    [numberCount, booleanCount, selectCount, groupCount]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentType: InnerFieldType) => {
      const currentIndex = FIELD_TYPE_ORDER.indexOf(currentType);
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          nextIndex = (currentIndex + 1) % FIELD_TYPE_ORDER.length;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = (currentIndex - 1 + FIELD_TYPE_ORDER.length) % FIELD_TYPE_ORDER.length;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = FIELD_TYPE_ORDER.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        const nextType = FIELD_TYPE_ORDER[nextIndex];
        const nextCount = getCounts(nextType);
        // Skip disabled items (items with 0 count when fixed pricing)
        if (isFixedPricing || nextCount === 0) {
          // Find next available item in the direction
          const direction = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1;
          for (let i = 1; i < FIELD_TYPE_ORDER.length; i++) {
            const checkIndex =
              (nextIndex + i * direction + FIELD_TYPE_ORDER.length) % FIELD_TYPE_ORDER.length;
            const checkType = FIELD_TYPE_ORDER[checkIndex];
            const checkCount = getCounts(checkType);
            if (!isFixedPricing && checkCount > 0) {
              nextIndex = checkIndex;
              break;
            }
          }
        }

        const finalType = FIELD_TYPE_ORDER[nextIndex];
        onValueChange(finalType);
        itemRefs.current.get(finalType)?.focus();
      }
    },
    [getCounts, isFixedPricing, onValueChange]
  );

  const currentTip = PRICING_FIELD_TYPE_TIPS[value];

  return (
    <div className="flex flex-col gap-4">
      {/* Field type navigation */}
      <div
        role="radiogroup"
        aria-label="Field type"
        aria-describedby={`${groupId}-tip`}
        className="flex flex-col gap-1"
        data-tour="pricing-field-type-nav"
      >
        {FIELD_TYPE_CONFIGS.map((config) => {
          const count = getCounts(config.type);
          const isSelected = value === config.type;
          const isDisabled = disabled || isFixedPricing || count === 0;
          const Icon = config.icon;

          return (
            <button
              key={config.type}
              ref={(el) => {
                if (el) {
                  itemRefs.current.set(config.type, el);
                } else {
                  itemRefs.current.delete(config.type);
                }
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) {
                  onValueChange(config.type);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, config.type)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected
                  ? "bg-primary/10 border border-primary/30 text-primary font-medium"
                  : "hover:bg-muted/50 border border-transparent",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded flex items-center justify-center shrink-0",
                  config.iconBgClass
                )}
              >
                <Icon className={cn("h-4 w-4", config.iconColorClass)} />
              </div>
              <span className="flex-1 text-sm">{config.label}</span>
              {count > 0 ? (
                <Badge variant={isSelected ? "default" : "secondary"} className="text-xs">
                  {count}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">(0)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contextual tip card */}
      <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30">
        <CardContent className="p-3" id={`${groupId}-tip`}>
          <div className="flex gap-2">
            <div className="shrink-0 mt-0.5">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {currentTip.title}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">{currentTip.body}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { FIELD_TYPE_CONFIGS, PRICING_FIELD_TYPE_TIPS };
