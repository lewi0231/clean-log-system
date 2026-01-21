"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OrganizationUserStatus } from "@/lib/types";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface StatusBadgeProps {
  status: OrganizationUserStatus;
  showTooltip?: boolean;
}

const statusConfig = {
  active: {
    variant: "default" as const,
    icon: CheckCircle,
    text: "Active",
    tooltip: "User can access the dashboard",
  },
  pending: {
    variant: "secondary" as const,
    icon: Clock,
    text: "Pending",
    tooltip: "Invitation sent - waiting for user to set up their account",
  },
  inactive: {
    variant: "destructive" as const,
    icon: AlertCircle,
    text: "Inactive",
    tooltip: "User access has been disabled",
  },
};

export default function StatusBadge({
  status,
  showTooltip = true,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className="cursor-default">
      <Icon className="w-3 h-3 mr-1" />
      {config.text}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
