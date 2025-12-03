"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChevronDown, Layers, MapPin, Settings2 } from "lucide-react";
import { useState } from "react";

interface AdvancedPricingDrawerProps {
  className?: string;
}

const featureHighlights = [
  {
    icon: MapPin,
    title: "Location overrides",
    description:
      "Copy base prices, then layer company → region → site adjustments without losing sight of inheritance.",
  },
  {
    icon: Layers,
    title: "Conditional logic",
    description:
      "Attach if/then rules to any field to handle after-hours, premium surfaces, or weather contingencies.",
  },
  {
    icon: Settings2,
    title: "Tiered calculators",
    description:
      "Compose unit, fixed, and percentage adjustments to match complex invoicing agreements.",
  },
];

export function AdvancedPricingDrawer({
  className,
}: AdvancedPricingDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">
            Advanced pricing toolkit
          </p>
          <p className="text-sm text-muted-foreground">
            Keep the UI light for simple cases, expand when you need overrides,
            conditions, or tiers.
          </p>
        </div>
        <Badge variant="secondary" className="ml-3 shrink-0">
          {open ? "Hide" : "Show"}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Separator />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          {featureHighlights.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-md border bg-muted/40 p-3 text-sm"
            >
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Icon className="h-4 w-4 text-primary" />
                {title}
              </div>
              <p className="text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
      <ChevronDown
        className={cn(
          "mx-auto mb-2 h-4 w-4 text-muted-foreground transition-transform",
          open ? "rotate-180" : "rotate-0"
        )}
      />
    </Collapsible>
  );
}
