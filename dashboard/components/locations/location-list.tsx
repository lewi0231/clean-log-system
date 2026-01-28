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
      hierarchy_parent_id?: string | null;
      active?: boolean;
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
    },
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
    null,
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
      hierarchy_parent_id?: string | null;
      active?: boolean;
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
    },
    locationId?: string,
  ) => {
    setIsFormOpen(false);
    if (locationId && editingLocation) {
      await onUpdateLocation(locationId, locationData);
    }
    setEditingLocation(null);
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={9} />;
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
              <TableHead>Status</TableHead>
              <TableHead>Region / Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
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
                <TableRow
                  key={location.id}
                  className="group hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        location.active
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {location.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {location.hierarchy_parent ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                          {location.hierarchy_parent.name}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {location.hierarchy_parent.type}
                        </span>
                      </div>
                    ) : (
                      <div className="text-center">-</div>
                    )}
                  </TableCell>
                  <TableCell>{location.email}</TableCell>
                  <TableCell>{location.address || "-"}</TableCell>
                  <TableCell>{location.contact_person || "-"}</TableCell>
                  <TableCell className="text-center">
                    {location.phone || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(location)}
                        className="cursor-pointer"
                        aria-label={`Edit ${location.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingLocation(location)}
                        className="cursor-pointer"
                        aria-label={`Delete ${location.name}`}
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
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
