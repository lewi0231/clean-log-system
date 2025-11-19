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
import { Location } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import LocationForm from "./location-form";

interface LocationListProps {
  locations: Location[];
  loading: boolean;
  error: string | null;
  onDeleteLocation: (locationId: string) => Promise<void>;
  onUpdateLocation: (
    locationId: string,
    locationData: {
      name: string;
      email: string;
      address: string;
      contact_person: string;
      phone?: string;
    }
  ) => Promise<void>;
}

export default function LocationList({
  locations,
  loading,
  error,
  onDeleteLocation,
  onUpdateLocation,
}: LocationListProps) {
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(
    null
  );

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingLocation) return;
    await onDeleteLocation(deletingLocation.id);
    setDeletingLocation(null);
  };

  const handleFormSuccess = async (
    locationData: {
      name: string;
      email: string;
      address: string;
      contact_person: string;
      phone?: string;
    },
    locationId?: string
  ) => {
    setIsFormOpen(false);
    if (locationId && editingLocation) {
      await onUpdateLocation(locationId, locationData);
    }
    setEditingLocation(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading locations...</div>;
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
              <TableHead>Address</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No locations found. Add your first location to get started.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>{location.email}</TableCell>
                  <TableCell>{location.address || "-"}</TableCell>
                  <TableCell>{location.contact_person || "-"}</TableCell>
                  <TableCell>{location.phone || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        location.active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {location.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(location.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(location)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingLocation(location)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LocationForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingLocation(null);
          }
        }}
        onSuccess={handleFormSuccess}
        location={editingLocation}
      />

      <AlertDialog
        open={!!deletingLocation}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingLocation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              location &quot;{deletingLocation?.name}&quot;.
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
