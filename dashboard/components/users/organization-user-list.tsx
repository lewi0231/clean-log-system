"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { log } from "@/lib/logger";
import { OrganizationUser } from "@/lib/types";
import { Mail, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import OrganizationUserForm from "./organization-user-form";
import StatusBadge from "./status-badge";

interface OrganizationUserListProps {
  organizationUsers: OrganizationUser[];
  loading: boolean;
  error: string | null;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateUser: (
    userId: string,
    userData: {
      role: "admin" | "viewer";
      first_name?: string;
      last_name?: string;
      phone?: string | null;
    }
  ) => Promise<void>;
  onResendInvitation?: (userId: string) => Promise<void>;
  onConvertToWorker?: (userId: string) => Promise<void>;
}

export default function OrganizationUserList({
  organizationUsers,
  loading,
  error,
  onDeleteUser,
  onUpdateUser,
  onResendInvitation,
  onConvertToWorker,
}: OrganizationUserListProps) {
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<OrganizationUser | null>(
    null
  );
  const [resendingUser, setResendingUser] = useState<OrganizationUser | null>(
    null
  );
  const [isResending, setIsResending] = useState(false);
  const [convertingUser, setConvertingUser] =
    useState<OrganizationUser | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleEdit = (user: OrganizationUser) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    await onDeleteUser(deletingUser.id);
    setDeletingUser(null);
  };

  const handleResendInvitation = async () => {
    if (!resendingUser || !onResendInvitation) return;

    try {
      setIsResending(true);
      await onResendInvitation(resendingUser.id);
      log.info("OrganizationUserList: Invitation resent successfully", {
        userId: resendingUser.id,
      });
      setResendingUser(null);
    } catch (err) {
      log.error("OrganizationUserList: Failed to resend invitation", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleConvertToWorker = async () => {
    if (!convertingUser || !onConvertToWorker) return;

    try {
      setIsConverting(true);
      await onConvertToWorker(convertingUser.id);
      log.info("OrganizationUserList: User converted to worker successfully", {
        userId: convertingUser.id,
      });
      setConvertingUser(null);
    } catch (err) {
      log.error("OrganizationUserList: Failed to convert user to worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleFormSuccess = async (
    userData: {
      role: "admin" | "viewer";
      first_name?: string;
      last_name?: string;
      phone?: string | null;
    },
    userId?: string
  ) => {
    if (userId && editingUser) {
      await onUpdateUser(userId, userData);
    }
  };

  const formatName = (user: OrganizationUser): string => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) return user.first_name;
    if (user.last_name) return user.last_name;
    return "-";
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={6} />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error: {error}</div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizationUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No dashboard users found. Invite your first user to get
                  started.
                </TableCell>
              </TableRow>
            ) : (
              organizationUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatName(user)}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {user.role === "admin" ? "Admin" : "Viewer"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(user.invited_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex justify-end gap-2">
                        {user.status === "pending" && onResendInvitation && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setResendingUser(user)}
                                className="cursor-pointer"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Resend invitation email
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {user.status === "active" &&
                          user.auth_user_id &&
                          onConvertToWorker && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setConvertingUser(user)}
                                  className="cursor-pointer"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Add as worker (mobile app access)
                              </TooltipContent>
                            </Tooltip>
                          )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(user)}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit user</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingUser(user)}
                              className="cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete user</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <OrganizationUserForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingUser(null);
          }
        }}
        onSuccess={handleFormSuccess}
        user={editingUser}
      />

      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will remove the dashboard user
              &quot;{deletingUser?.email}&quot; from your organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!resendingUser}
        onOpenChange={(open) => {
          if (!open && !isResending) {
            setResendingUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Invitation Email</AlertDialogTitle>
            <AlertDialogDescription>
              Send a new invitation email to &quot;
              {resendingUser?.first_name && resendingUser?.last_name
                ? `${resendingUser.first_name} ${resendingUser.last_name}`
                : resendingUser?.email}
              &quot; ({resendingUser?.email})? They will receive a link to set
              up their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResendInvitation}
              disabled={isResending}
            >
              {isResending ? "Sending..." : "Resend Email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!convertingUser}
        onOpenChange={(open) => {
          if (!open && !isConverting) {
            setConvertingUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add as Worker</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow &quot;
              {convertingUser?.first_name && convertingUser?.last_name
                ? `${convertingUser.first_name} ${convertingUser.last_name}`
                : convertingUser?.email}
              &quot; to use the mobile app with their existing login
              credentials.
              <br />
              <br />
              They will be able to submit jobs through the mobile app while
              keeping their dashboard access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConverting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertToWorker}
              disabled={isConverting}
            >
              {isConverting ? "Converting..." : "Add as Worker"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
