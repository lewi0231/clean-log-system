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
import { Worker } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import WorkerForm from "./worker-form";

interface WorkerListProps {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  onDeleteWorker: (workerId: string) => Promise<void>;
  onUpdateWorker: (
    workerId: string,
    workerData: { name: string; email: string; phone: string; active?: boolean }
  ) => Promise<void>;
}

export default function WorkerList({
  workers,
  loading,
  error,
  onDeleteWorker,
  onUpdateWorker,
}: WorkerListProps) {
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null);

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingWorker) return;
    await onDeleteWorker(deletingWorker.id);
    setDeletingWorker(null);
  };

  const handleFormSuccess = async (
    workerData: {
      name: string;
      email: string;
      phone: string;
      active?: boolean;
    },
    workerId?: string
  ) => {
    setIsFormOpen(false);
    if (workerId && editingWorker) {
      await onUpdateWorker(workerId, workerData);
    }
    setEditingWorker(null);
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
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
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>{worker.email || "-"}</TableCell>
                  <TableCell>{worker.phone || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        worker.active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {worker.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(worker.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(worker)}
                      >
                        <Pencil className="h-4 w-4 cursor-pointer" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingWorker(worker)}
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
    </>
  );
}
