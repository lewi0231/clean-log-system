"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";

export function UnifiedInvoicePreview() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="sticky top-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">
                Sample Invoice Calculation
              </CardTitle>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              {/* Field Pricing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">
                    Field Pricing
                  </span>
                  <span className="font-mono font-medium">$250.00</span>
                </div>
                <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>• Cars cleaned (5 × $50)</span>
                    <span className="font-mono">$250</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Group & Option Pricing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">
                    Group & Option Pricing
                  </span>
                  <span className="font-mono font-medium">$180.00</span>
                </div>
                <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>• Service Type: Full Detail</span>
                    <span className="font-mono">$180</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Base Pricing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">
                    Base Pricing
                  </span>
                  <span className="font-mono font-medium">$50.00</span>
                </div>
                <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>• Fixed base amount</span>
                    <span className="font-mono">$50</span>
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-medium">$480.00</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="font-mono font-semibold text-lg">
                    $480.00
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1 text-foreground">How it works:</p>
              <p>
                Prices are calculated in order: Field Pricing → Group & Option
                Pricing → Base Pricing. Base pricing can add a fixed amount or
                multiply the entire subtotal.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
