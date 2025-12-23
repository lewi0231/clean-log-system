"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { log } from "@/lib/logger";
import type { LocationHierarchyNode } from "@/lib/types";
import { locationSchema } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";

interface LocationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (
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
    locationId?: string
  ) => void | Promise<void>;
  location?: {
    id: string;
    name: string;
    email: string;
    address: string | null;
    contact_person: string | null;
    phone: string | null;
    active?: boolean;
    hierarchy_parent_id?: string | null;
    pricing_mode?: "field_based" | "fixed_price";
    fixed_customer_price?: number | null;
    fixed_worker_payment?: number | null;
    fixed_price_currency?: string | null;
  } | null;
}

export default function LocationForm({
  open,
  onOpenChange,
  onSuccess,
  location,
}: LocationFormProps) {
  const { nodes: hierarchyNodes } = useLocationHierarchy();

  type LocationFormValues = {
    name: string;
    email: string;
    address: string;
    contact_person: string;
    phone?: string;
    hierarchy_parent_id?: string | null;
    active?: boolean;
    pricing_mode?: "field_based" | "fixed_price";
    fixed_customer_price?: number;
    fixed_worker_payment?: number;
    fixed_price_currency?: string;
  };

  const defaultValues = useMemo<LocationFormValues>(
    () => ({
      name: location?.name || "",
      email: location?.email || "",
      address: location?.address || "",
      contact_person: location?.contact_person || "",
      phone: location?.phone || "",
      hierarchy_parent_id: location?.hierarchy_parent_id || null,
      active: location?.active ?? true, // Default to active for new locations
      pricing_mode: "field_based", // Always default to field-based
      fixed_customer_price: undefined,
      fixed_worker_payment: undefined,
      fixed_price_currency: undefined,
    }),
    [location]
  );

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues,
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
    control,
  } = form;

  const hierarchyParentId = useWatch({
    control,
    name: "hierarchy_parent_id",
  });

  const activeStatus = useWatch({
    control,
    name: "active",
    defaultValue: defaultValues.active,
  });

  // Build a flat list with indentation for display
  const hierarchyOptions = useMemo(() => {
    const options: Array<{ node: LocationHierarchyNode; indent: number }> = [];

    const addNode = (node: LocationHierarchyNode, indent: number) => {
      options.push({ node, indent });
      // Find children
      hierarchyNodes
        .filter((n) => n.parent_id === node.id)
        .forEach((child) => addNode(child, indent + 1));
    };

    // Start with root nodes (no parent)
    hierarchyNodes
      .filter((n) => !n.parent_id)
      .forEach((root) => addNode(root, 0));

    return options;
  }, [hierarchyNodes]);

  const isEditMode = !!location;

  const onSubmit = async (values: LocationFormValues) => {
    log.info("LocationForm: Submitting location", {
      isEditMode,
      locationId: location?.id,
    });

    // Always use field_based pricing mode
    await onSuccess(
      {
        name: values.name,
        email: values.email,
        address: values.address,
        contact_person: values.contact_person,
        phone: values.phone || undefined,
        hierarchy_parent_id: values.hierarchy_parent_id ?? null,
        active: values.active ?? true,
        pricing_mode: "field_based",
        fixed_customer_price: null,
        fixed_worker_payment: null,
        fixed_price_currency: null,
      },
      location?.id
    );

    reset(defaultValues);
    onOpenChange(false);
  };

  // Reset form when dialog opens/closes or location changes
  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Location" : "Add Location"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update location information."
              : "Add a new location to your organization."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Main Location"
              aria-invalid={!!errors.name}
              {...register("name")}
              required
            />
            {errors.name?.message && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Contact Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="location@example.com"
              aria-invalid={!!errors.email}
              {...register("email")}
              required
            />
            {errors.email?.message && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              type="text"
              placeholder="123 Main St, City, State 12345"
              aria-invalid={!!errors.address}
              {...register("address")}
              required
            />
            {errors.address?.message && (
              <p className="text-sm text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person</Label>
            <Input
              id="contact_person"
              type="text"
              placeholder="John Doe"
              aria-invalid={!!errors.contact_person}
              {...register("contact_person")}
              required
            />
            {errors.contact_person?.message && (
              <p className="text-sm text-destructive">
                {errors.contact_person.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Contact Phone (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
            {errors.phone?.message && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hierarchy_parent">
              Region / Company (Optional)
            </Label>
            {hierarchyOptions.length > 0 ? (
              <>
                <Select
                  value={hierarchyParentId || "none"}
                  onValueChange={(value) =>
                    setValue(
                      "hierarchy_parent_id",
                      value === "none" ? null : value
                    )
                  }
                >
                  <SelectTrigger id="hierarchy_parent">
                    <SelectValue placeholder="Select region for pricing..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      No region (org default)
                    </SelectItem>
                    {hierarchyOptions.map(({ node, indent }) => (
                      <SelectItem key={node.id} value={node.id}>
                        {"  ".repeat(indent)}
                        {node.name} ({node.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assign this location to a region or company for regional
                  pricing rules.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground p-2 bg-muted rounded">
                No regions or companies defined yet. Create them in the{" "}
                <Link
                  href="/dashboard/locations?tab=hierarchy"
                  className="font-medium text-primary hover:underline"
                >
                  Location Hierarchy
                </Link>{" "}
                tab to enable regional pricing for this location.
              </p>
            )}
          </div>

          {/* Active Status - Only show in edit mode */}
          {isEditMode && (
            <div className="flex items-center justify-between gap-8 rounded-lg border p-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="active" className="text-sm font-medium">
                  Active Status
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive locations won&apos;t appear as options in the mobile
                  app but will remain in the location list.
                </p>
              </div>
              <Switch
                id="active"
                checked={activeStatus ?? true}
                onCheckedChange={(checked) => setValue("active", checked)}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
              />
            </div>
          )}

          {/* Pricing Information */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-muted">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="mt-0.5 cursor-pointer"
                    aria-label="Pricing information"
                  >
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-sm bg-popover text-popover-foreground border border-border"
                >
                  <div className="space-y-2">
                    <p className="font-medium text-popover-foreground">
                      Pricing Configuration
                    </p>
                    <p className="text-sm text-popover-foreground">
                      This location uses <strong>field-based pricing</strong>.
                      Prices are calculated from your field configurations and
                      pricing rules set in the{" "}
                      <Link
                        href="/dashboard/pricing"
                        className="text-primary hover:underline font-medium"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        Pricing page
                      </Link>
                      .
                    </p>
                    <p className="text-sm text-popover-foreground/90">
                      You can set location-specific pricing rules by selecting
                      this location in the Pricing page&apos;s scope selector.
                    </p>
                    <p className="text-xs text-popover-foreground/80 pt-2 border-t border-border">
                      Fixed pricing per location may be available in a future
                      update.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Pricing</p>
              <p className="text-xs text-muted-foreground">
                This location uses field-based pricing. Configure pricing rules
                in the{" "}
                <Link
                  href="/dashboard/pricing"
                  className="font-medium text-primary hover:underline"
                >
                  Pricing page
                </Link>
                .
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : isEditMode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
