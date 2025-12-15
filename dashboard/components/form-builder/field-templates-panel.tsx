"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BUILT_IN_TEMPLATES, FieldTemplate } from "@clean-log/shared";
import { Calendar, Car, FileText, Ruler, User, Wrench } from "lucide-react";

interface FieldTemplatesPanelProps {
  onApplyTemplate: (template: FieldTemplate) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  Car,
  Wrench,
  Ruler,
  Calendar,
  FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  contact: "bg-primary/10 text-primary border-primary/20",
  vehicle: "bg-success/10 text-success border-success/20",
  service: "bg-accent/10 text-accent border-accent/20",
  measurement: "bg-warning/10 text-warning border-warning/20",
  general: "bg-muted text-muted-foreground border-border",
};

export function FieldTemplatesPanel({
  onApplyTemplate,
}: FieldTemplatesPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Quick Templates</CardTitle>
        <CardDescription className="text-xs">
          Add common field groups with one click
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-2">
          <TooltipProvider>
            {BUILT_IN_TEMPLATES.map((template) => {
              const IconComponent = ICON_MAP[template.icon] || FileText;
              const categoryColor =
                CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general;

              return (
                <Tooltip key={template.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApplyTemplate(template)}
                      className="flex flex-col items-start h-auto py-3 px-3 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className={`p-1.5 rounded-md ${categoryColor} border`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-xs truncate">
                          {template.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 w-full">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {template.fields.length} fields
                        </Badge>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <div className="space-y-1">
                      <p className="font-medium text-xs">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                      <div className="pt-1 border-t mt-1">
                        <p className="text-xs text-muted-foreground">
                          Fields:{" "}
                          {template.fields.map((f) => f.label).join(", ")}
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
