"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { log } from "@/lib/logger";
import type { LocationHierarchyNode } from "@/lib/types";
import { locationSchema } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const { currency: orgCurrency } = useOrganizationCurrency();
  const [pricingSectionOpen, setPricingSectionOpen] = useState(false);

  type LocationFormValues = {
    name: string;
    email: string;
    address: string;
    contact_person: string;
    phone?: string;
    hierarchy_parent_id?: string | null;
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
      pricing_mode: location?.pricing_mode || "field_based",
      fixed_customer_price: location?.fixed_customer_price ?? undefined,
      fixed_worker_payment: location?.fixed_worker_payment ?? undefined,
      fixed_price_currency: location?.fixed_price_currency || orgCurrency,
    }),
    [location, orgCurrency]
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

  const pricingMode = useWatch({
    control,
    name: "pricing_mode",
    defaultValue: defaultValues.pricing_mode,
  });

  const hierarchyParentId = useWatch({
    control,
    name: "hierarchy_parent_id",
  });

  const fixedPriceCurrency = useWatch({
    control,
    name: "fixed_price_currency",
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

    const pricingData: {
      pricing_mode?: "field_based" | "fixed_price";
      fixed_customer_price?: number | null;
      fixed_worker_payment?: number | null;
      fixed_price_currency?: string | null;
    } = {
      pricing_mode: values.pricing_mode,
    };

    if (values.pricing_mode === "fixed_price") {
      pricingData.fixed_customer_price = values.fixed_customer_price ?? null;
      pricingData.fixed_worker_payment = values.fixed_worker_payment ?? null;
      pricingData.fixed_price_currency =
        values.fixed_price_currency ?? orgCurrency;
    }

    await onSuccess(
      {
        name: values.name,
        email: values.email,
        address: values.address,
        contact_person: values.contact_person,
        phone: values.phone || undefined,
        hierarchy_parent_id: values.hierarchy_parent_id ?? null,
        ...pricingData,
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
      // Open pricing section if location has fixed pricing
      if (defaultValues.pricing_mode === "fixed_price") {
        setPricingSectionOpen(true);
      } else {
        setPricingSectionOpen(false);
      }
    }
  }, [open, defaultValues, reset]);

  useEffect(() => {
    setPricingSectionOpen(pricingMode === "fixed_price");
  }, [pricingMode]);

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
                <strong>Location Hierarchy</strong> tab to enable regional
                pricing for this location.
              </p>
            )}
          </div>

          <Collapsible
            open={pricingSectionOpen}
            onOpenChange={setPricingSectionOpen}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                {pricingSectionOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Label className="text-base font-medium cursor-pointer">
                  Pricing Configuration
                </Label>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-3">
                <Label>Pricing Mode</Label>
                <RadioGroup
                  value={pricingMode}
                  onValueChange={(value) =>
                    setValue(
                      "pricing_mode",
                      value as "field_based" | "fixed_price"
                    )
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="field_based" id="field_based" />
                    <Label
                      htmlFor="field_based"
                      className="font-normal cursor-pointer"
                    >
                      Field-Based Pricing
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Prices calculated from field configs and pricing rules
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="fixed_price" id="fixed_price" />
                    <Label
                      htmlFor="fixed_price"
                      className="font-normal cursor-pointer"
                    >
                      Fixed Price
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Use a fixed price regardless of field data (field data still
                    collected)
                  </p>
                </RadioGroup>
              </div>

              {pricingMode === "fixed_price" && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Field config data will still be collected for operational
                      purposes, but pricing will use the fixed amounts below.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fixed_customer_price">
                      Fixed Customer Price{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fixed_customer_price"
                      type="number"
                      step="0.01"
                      min="0"
                      aria-invalid={!!errors.fixed_customer_price}
                      placeholder="0.00"
                      required
                      {...register("fixed_customer_price", {
                        setValueAs: (val) =>
                          val === "" || val === null
                            ? undefined
                            : parseFloat(val),
                      })}
                    />
                    {errors.fixed_customer_price && (
                      <p className="text-sm text-destructive">
                        {errors.fixed_customer_price.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fixed_worker_payment">
                      Fixed Worker Payment (Optional)
                    </Label>
                    <Input
                      id="fixed_worker_payment"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("fixed_worker_payment", {
                        setValueAs: (val) =>
                          val === "" || val === null
                            ? undefined
                            : parseFloat(val),
                      })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount paid to workers for jobs at this location
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fixed_price_currency">Currency</Label>
                    <Select
                      value={fixedPriceCurrency || orgCurrency || undefined}
                      onValueChange={(value) =>
                        setValue("fixed_price_currency", value)
                      }
                    >
                      <SelectTrigger id="fixed_price_currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="AUD">
                          AUD - Australian Dollar
                        </SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="CAD">
                          CAD - Canadian Dollar
                        </SelectItem>
                        <SelectItem value="NZD">
                          NZD - New Zealand Dollar
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
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
