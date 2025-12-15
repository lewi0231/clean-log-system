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
import { OrganizationUser } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import OrganizationUserForm from "./organization-user-form";

interface OrganizationUserListProps {
  organizationUsers: OrganizationUser[];
  loading: boolean;
  error: string | null;
  onDeleteUser: (userId: string) => Promise<void>;
  onUpdateUser: (
    userId: string,
    userData: { role: "admin" | "viewer" }
  ) => Promise<void>;
}

export default function OrganizationUserList({
  organizationUsers,
  loading,
  error,
  onDeleteUser,
  onUpdateUser,
}: OrganizationUserListProps) {
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<OrganizationUser | null>(
    null
  );

  const handleEdit = (user: OrganizationUser) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    await onDeleteUser(deletingUser.id);
    setDeletingUser(null);
  };

  const handleFormSuccess = async (
    userData: {
      role: "admin" | "viewer";
    },
    userId?: string
  ) => {
    setIsFormOpen(false);
    if (userId && editingUser) {
      await onUpdateUser(userId, userData);
    }
    setEditingUser(null);
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={4} />;
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
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizationUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  No dashboard users found. Add your first user to get started.
                </TableCell>
              </TableRow>
            ) : (
              organizationUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
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
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4 cursor-pointer" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingUser(user)}
                      >
                        <Trash2 className="cursor-pointer h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
    </>
  );
}
