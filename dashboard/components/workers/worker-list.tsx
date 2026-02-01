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
import { Worker } from "@/lib/types";
import { Mail, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import WorkerForm from "./worker-form";

interface WorkerListProps {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  onDeleteWorker: (workerId: string) => Promise<void>;
  onUpdateWorker: (
    workerId: string,
    workerData: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      active?: boolean;
    }
  ) => Promise<void>;
  onResendInvitation?: (workerId: string) => Promise<void>;
  organizationId?: string | null;
}

export default function WorkerList({
  workers,
  loading,
  error,
  onDeleteWorker,
  onUpdateWorker,
  onResendInvitation,
  organizationId,
}: WorkerListProps) {
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null);
  const [resendingWorker, setResendingWorker] = useState<Worker | null>(null);
  const [isResending, setIsResending] = useState(false);

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingWorker) return;
    await onDeleteWorker(deletingWorker.id);
    setDeletingWorker(null);
  };

  const handleResendInvitation = async () => {
    if (!resendingWorker || !onResendInvitation || !organizationId) return;

    try {
      setIsResending(true);
      await onResendInvitation(resendingWorker.id);
      log.info("WorkerList: Invitation resent successfully", {
        workerId: resendingWorker.id,
      });
      setResendingWorker(null);
      toast.success(`Invitation email has been sent to ${resendingWorker.email}`);
    } catch (err) {
      log.error("WorkerList: Failed to resend invitation", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error(
        `Failed to resend invitation: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleFormSuccess = async (
    workerData: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      active?: boolean;
    },
    workerId?: string
  ) => {
    if (workerId && editingWorker) {
      await onUpdateWorker(workerId, workerData);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading workers...</div>;
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
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No workers found. Add your first worker to get started.
                </TableCell>
              </TableRow>
            ) : (
              workers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium cursor-default ${
                              worker.active
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {worker.active ? "Active" : "Inactive"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {worker.active
                            ? "This user is able to submit new jobs"
                            : "An email has been sent to complete the signup process"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="font-medium">
                    {worker.first_name && worker.last_name
                      ? `${worker.first_name} ${worker.last_name}`
                      : worker.name || "N/A"}
                  </TableCell>
                  <TableCell>{worker.email || "-"}</TableCell>
                  <TableCell>{worker.phone || "-"}</TableCell>
                  <TableCell>
                    {new Date(worker.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex justify-end gap-2">
                        {!worker.active &&
                          !worker.auth_user_id &&
                          onResendInvitation && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setResendingWorker(worker)}
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(worker)}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit worker</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingWorker(worker)}
                              className="cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete worker</TooltipContent>
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

      <WorkerForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingWorker(null);
          }
        }}
        onSuccess={handleFormSuccess}
        worker={editingWorker}
      />

      <AlertDialog
        open={!!deletingWorker}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingWorker(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              worker &quot;{deletingWorker?.name}&quot;.
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
        open={!!resendingWorker}
        onOpenChange={(open) => {
          if (!open && !isResending) {
            setResendingWorker(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Invitation Email</AlertDialogTitle>
            <AlertDialogDescription>
              Send a new invitation email to &quot;{resendingWorker?.name}&quot;
              ({resendingWorker?.email})? They will receive a link to set up
              their account.
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
    </>
  );
}
