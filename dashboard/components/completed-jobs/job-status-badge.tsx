"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { JobApprovalStatus } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobStatusBadgeProps {
  status: JobApprovalStatus;
  autoApproveAt?: string | null;
  className?: string;
}

const statusConfig: Record<
  JobApprovalStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
    className?: string;
  }
> = {
  approved: {
    label: "Approved",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-500 hover:bg-green-600",
  },
  pending: {
    label: "Pending confirmation",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-yellow-500 text-white hover:bg-yellow-600",
  },
  flagged: {
    label: "Flagged",
    variant: "destructive",
    icon: <AlertTriangle className="h-3 w-3" />,
    className: "",
  },
  cancelled: {
    label: "Cancelled",
    variant: "outline",
    icon: <XCircle className="h-3 w-3" />,
    className: "text-muted-foreground",
  },
};

export default function JobStatusBadge({
  status,
  autoApproveAt,
  className = "",
}: JobStatusBadgeProps) {
  // Default to approved if status is not set (backward compatibility)
  const effectiveStatus = status || "approved";
  const config = statusConfig[effectiveStatus];

  // Don't show badge for approved jobs - they are the normal state
  if (effectiveStatus === "approved") {
    return null;
  }

  const badge = (
    <Badge variant={config.variant} className={`${config.className} ${className} gap-1`}>
      {config.icon}
      {config.label}
    </Badge>
  );

  // Add tooltip for pending jobs showing auto-approve time
  if (effectiveStatus === "pending" && autoApproveAt) {
    const autoApproveDate = new Date(autoApproveAt);
    const isPast = autoApproveDate < new Date();
    const timeText = isPast
      ? "Auto-approving soon..."
      : `Auto-approves ${formatDistanceToNow(autoApproveDate, { addSuffix: true })}`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{timeText}</p>
            <p className="text-xs text-muted-foreground">Awaiting colleague confirmation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Add tooltip for flagged jobs
  if (effectiveStatus === "flagged") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>This job has been flagged by a worker</p>
            <p className="text-xs text-muted-foreground">Requires admin review</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
