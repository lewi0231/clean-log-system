"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDestructiveDialog } from "@/components/ui/confirm-destructive-dialog";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { resolveHierarchyBadges } from "@/lib/location-hierarchy-badges";
import { Location, LocationHierarchyNode } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import LocationForm from "./location-form";

function HierarchyBadges({
  hierarchyParent,
  hierarchyParentId,
  nodes,
}: {
  hierarchyParent: Location["hierarchy_parent"];
  hierarchyParentId: string | null;
  nodes: LocationHierarchyNode[];
}) {
  const badges = resolveHierarchyBadges(hierarchyParent, hierarchyParentId, nodes);

  if (badges.length === 0) {
    return <div className="text-center">-</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((badge) => (
        <span
          key={`${badge.kind}-${badge.id}`}
          className={
            badge.kind === "company"
              ? "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300"
              : "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }
          title={badge.kind === "company" ? "Company" : "Region"}
        >
          {badge.name}
        </span>
      ))}
    </div>
  );
}

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
      feedback_requests_enabled?: boolean;
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
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
  const { nodes: hierarchyNodes } = useLocationHierarchy();
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);

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
      feedback_requests_enabled?: boolean;
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
    },
    locationId?: string
  ) => {
    if (locationId && editingLocation) {
      await onUpdateLocation(locationId, locationData);
    }
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={9} />;
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Error: {error}</div>;
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
                <TableRow key={location.id} className="group hover:bg-muted/50 transition-colors">
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
                    {location.feedback_requests_enabled === false && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-muted text-muted-foreground"
                        title="Feedback request emails are muted for this location"
                      >
                        Feedback off
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <HierarchyBadges
                      hierarchyParent={location.hierarchy_parent}
                      hierarchyParentId={location.hierarchy_parent_id}
                      nodes={hierarchyNodes}
                    />
                  </TableCell>
                  <TableCell>{location.email}</TableCell>
                  <TableCell>{location.address || "-"}</TableCell>
                  <TableCell>{location.contact_person || "-"}</TableCell>
                  <TableCell className="text-center">{location.phone || "-"}</TableCell>
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

      <ConfirmDestructiveDialog
        open={!!deletingLocation}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingLocation(null);
          }
        }}
        description={
          <>
            This action cannot be undone. This will permanently delete the location &quot;
            {deletingLocation?.name}&quot;.
          </>
        }
        onConfirm={handleDelete}
      />
    </>
  );
}
