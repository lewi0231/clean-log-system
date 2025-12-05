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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocationHierarchy } from "@/hooks/use-location-hierarchy";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { log } from "@/lib/logger";
import type { LocationHierarchyNode } from "@/lib/types";
import { locationSchema } from "@/lib/validations";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const [name, setName] = useState(location?.name || "");
  const [email, setEmail] = useState(location?.email || "");
  const [address, setAddress] = useState(location?.address || "");
  const [contactPerson, setContactPerson] = useState(
    location?.contact_person || ""
  );
  const [phone, setPhone] = useState(location?.phone || "");
  const [hierarchyParentId, setHierarchyParentId] = useState<string | null>(
    location?.hierarchy_parent_id || null
  );
  const [pricingMode, setPricingMode] = useState<"field_based" | "fixed_price">(
    location?.pricing_mode || "field_based"
  );
  const [fixedCustomerPrice, setFixedCustomerPrice] = useState<string>(
    location?.fixed_customer_price?.toString() || ""
  );
  const [fixedWorkerPayment, setFixedWorkerPayment] = useState<string>(
    location?.fixed_worker_payment?.toString() || ""
  );
  const [fixedPriceCurrency, setFixedPriceCurrency] = useState<string>(
    location?.fixed_price_currency || orgCurrency
  );
  const [pricingSectionOpen, setPricingSectionOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    phone?: string;
    fixed_customer_price?: string;
  }>({});

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

  const validateInput = () => {
    log.debug("LocationForm: Validating form input");

    const result = locationSchema.safeParse({
      name,
      email,
      address,
      contact_person: contactPerson,
      phone: phone || undefined,
      pricing_mode: pricingMode,
      fixed_customer_price:
        pricingMode === "fixed_price" && fixedCustomerPrice
          ? parseFloat(fixedCustomerPrice)
          : undefined,
      fixed_worker_payment:
        pricingMode === "fixed_price" && fixedWorkerPayment
          ? parseFloat(fixedWorkerPayment)
          : undefined,
      fixed_price_currency:
        pricingMode === "fixed_price" ? fixedPriceCurrency : undefined,
    });

    if (!result.success) {
      const fieldErrors: {
        name?: string;
        email?: string;
        address?: string;
        contact_person?: string;
        phone?: string;
        fixed_customer_price?: string;
      } = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (
          path === "name" ||
          path === "email" ||
          path === "address" ||
          path === "contact_person" ||
          path === "phone" ||
          path === "fixed_customer_price"
        ) {
          fieldErrors[path] = issue.message;
        }
      });

      log.warn("LocationForm: Form validation failed", { errors: fieldErrors });
      setErrors(fieldErrors);
      throw new Error("Validation failed");
    }

    log.debug("LocationForm: Form validation passed");
    setErrors({});
    return result.data;
  };

  const handleSubmit = async () => {
    try {
      log.info("LocationForm: Starting location submission", {
        isEditMode,
        locationId: location?.id,
      });
      setIsLoading(true);
      setErrors({});

      const validatedData = validateInput();

      // The actual API call is now handled by the parent component
      // We just validate and call onSuccess with the data
      log.info("LocationForm: Form validated, calling onSuccess", {
        isEditMode,
        locationId: location?.id,
      });

      // Prepare pricing data
      const pricingData: {
        pricing_mode?: "field_based" | "fixed_price";
        fixed_customer_price?: number | null;
        fixed_worker_payment?: number | null;
        fixed_price_currency?: string | null;
      } = {
        pricing_mode: pricingMode,
      };

      if (pricingMode === "fixed_price") {
        pricingData.fixed_customer_price = fixedCustomerPrice
          ? parseFloat(fixedCustomerPrice)
          : null;
        pricingData.fixed_worker_payment = fixedWorkerPayment
          ? parseFloat(fixedWorkerPayment)
          : null;
        pricingData.fixed_price_currency = fixedPriceCurrency;
      }

      // Reset form
      setName("");
      setEmail("");
      setAddress("");
      setContactPerson("");
      setPhone("");
      setHierarchyParentId(null);
      setPricingMode("field_based");
      setFixedCustomerPrice("");
      setFixedWorkerPayment("");
      setFixedPriceCurrency(orgCurrency);
      setErrors({});
      onOpenChange(false);
      await onSuccess(
        {
          ...validatedData,
          hierarchy_parent_id: hierarchyParentId,
          ...pricingData,
        },
        location?.id
      );
    } catch (error) {
      if (error instanceof Error && error.message !== "Validation failed") {
        log.error("LocationForm: Submission failed", { error: error.message });
        setErrors({
          email: error.message.includes("email") ? error.message : undefined,
          name: error.message.includes("name") ? error.message : undefined,
          address: error.message.includes("address")
            ? error.message
            : undefined,
          contact_person: error.message.includes("contact")
            ? error.message
            : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when dialog opens/closes or location changes
  useEffect(() => {
    if (open) {
      setName(location?.name || "");
      setEmail(location?.email || "");
      setAddress(location?.address || "");
      setContactPerson(location?.contact_person || "");
      setPhone(location?.phone || "");
      setHierarchyParentId(location?.hierarchy_parent_id || null);
      setPricingMode(location?.pricing_mode || "field_based");
      setFixedCustomerPrice(
        location?.fixed_customer_price?.toString() || ""
      );
      setFixedWorkerPayment(location?.fixed_worker_payment?.toString() || "");
      setFixedPriceCurrency(location?.fixed_price_currency || orgCurrency);
      setErrors({});
      // Open pricing section if location has fixed pricing
      if (location?.pricing_mode === "fixed_price") {
        setPricingSectionOpen(true);
      }
    }
  }, [open, location, orgCurrency]);

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
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              placeholder="Main Location"
              aria-invalid={!!errors.name}
              required
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Contact Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="location@example.com"
              aria-invalid={!!errors.email}
              required
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              name="address"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errors.address) {
                  setErrors((prev) => ({ ...prev, address: undefined }));
                }
              }}
              placeholder="123 Main St, City, State 12345"
              aria-invalid={!!errors.address}
              required
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person</Label>
            <Input
              id="contact_person"
              name="contact_person"
              type="text"
              value={contactPerson}
              onChange={(e) => {
                setContactPerson(e.target.value);
                if (errors.contact_person) {
                  setErrors((prev) => ({ ...prev, contact_person: undefined }));
                }
              }}
              placeholder="John Doe"
              aria-invalid={!!errors.contact_person}
              required
            />
            {errors.contact_person && (
              <p className="text-sm text-destructive">
                {errors.contact_person}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Contact Phone (Optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) {
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              placeholder="+1234567890"
              aria-invalid={!!errors.phone}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
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
                    setHierarchyParentId(value === "none" ? null : value)
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
                  onValueChange={(value) => {
                    setPricingMode(value as "field_based" | "fixed_price");
                    if (value === "field_based") {
                      setFixedCustomerPrice("");
                      setFixedWorkerPayment("");
                    }
                    setErrors((prev) => ({
                      ...prev,
                      fixed_customer_price: undefined,
                    }));
                  }}
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
                      Fixed Customer Price <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fixed_customer_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={fixedCustomerPrice}
                      onChange={(e) => {
                        setFixedCustomerPrice(e.target.value);
                        if (errors.fixed_customer_price) {
                          setErrors((prev) => ({
                            ...prev,
                            fixed_customer_price: undefined,
                          }));
                        }
                      }}
                      placeholder="0.00"
                      aria-invalid={!!errors.fixed_customer_price}
                      required
                    />
                    {errors.fixed_customer_price && (
                      <p className="text-sm text-destructive">
                        {errors.fixed_customer_price}
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
                      value={fixedWorkerPayment}
                      onChange={(e) => setFixedWorkerPayment(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount paid to workers for jobs at this location
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fixed_price_currency">Currency</Label>
                    <Select
                      value={fixedPriceCurrency}
                      onValueChange={setFixedPriceCurrency}
                    >
                      <SelectTrigger id="fixed_price_currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : isEditMode ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
