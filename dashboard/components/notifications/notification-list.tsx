"use client";

import type { Notification } from "@/lib/services/notification.service";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Trash2,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkAsRead: (notificationId: string) => Promise<void>;
  onClose: () => void;
}

const notificationIcons: Record<Notification["type"], React.ReactNode> = {
  worker_active: <User className="h-4 w-4 text-green-500" />,
  job_completed: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  invoice_generated: <FileText className="h-4 w-4 text-purple-500" />,
  payment_received: <Wallet className="h-4 w-4 text-emerald-500" />,
  review_submitted: <MessageSquare className="h-4 w-4 text-amber-500" />,
  admin_activated: <User className="h-4 w-4 text-indigo-500" />,
  worker_created: <User className="h-4 w-4 text-teal-500" />,
  // Job colleague confirmation workflow notifications
  job_confirmation_requested: <Clock className="h-4 w-4 text-yellow-500" />,
  job_confirmation_reminder: <Clock className="h-4 w-4 text-orange-500" />,
  job_flagged: <AlertTriangle className="h-4 w-4 text-red-500" />,
  job_withdrawn: <Trash2 className="h-4 w-4 text-gray-500" />,
  job_resolved_approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  job_resolved_cancelled: <XCircle className="h-4 w-4 text-red-500" />,
  job_auto_approved: <CheckCircle2 className="h-4 w-4 text-blue-400" />,
};

export default function NotificationList({
  notifications,
  loading,
  onMarkAsRead,
  onClose,
}: NotificationListProps) {
  const router = useRouter();

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await onMarkAsRead(notification.id);
    }

    // Navigate to related entity if available
    if (notification.related_entity_type && notification.related_entity_id) {
      // Prefer deep-linking to the specific entity where possible.
      // Fall back to the relevant list page.
      const routes: Record<string, string> = {
        worker: "/dashboard/users",
        job: "/dashboard/completed-jobs",
        // Invoicing lives at /dashboard/invoicing (and /dashboard/invoicing/[id])
        invoice: `/dashboard/invoicing/${notification.related_entity_id}`,
      };

      const route = routes[notification.related_entity_type];
      if (route) {
        onClose();
        router.push(route);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {notifications.map((notification) => (
        <button
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            "w-full text-left p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors",
            !notification.read && "bg-muted/30"
          )}
        >
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              {notificationIcons[notification.type] || (
                <Bell className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-sm",
                    !notification.read && "font-medium"
                  )}
                >
                  {notification.title}
                </p>
                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
