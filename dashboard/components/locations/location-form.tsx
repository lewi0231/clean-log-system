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
import { log } from "@/lib/logger";
import { locationSchema } from "@/lib/validations";
import { useEffect, useState } from "react";

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
  } | null;
}

export default function LocationForm({
  open,
  onOpenChange,
  onSuccess,
  location,
}: LocationFormProps) {
  const [name, setName] = useState(location?.name || "");
  const [email, setEmail] = useState(location?.email || "");
  const [address, setAddress] = useState(location?.address || "");
  const [contactPerson, setContactPerson] = useState(
    location?.contact_person || ""
  );
  const [phone, setPhone] = useState(location?.phone || "");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    phone?: string;
  }>({});

  const isEditMode = !!location;

  const validateInput = () => {
    log.debug("LocationForm: Validating form input");

    const result = locationSchema.safeParse({
      name,
      email,
      address,
      contact_person: contactPerson,
      phone: phone || undefined,
    });

    if (!result.success) {
      const fieldErrors: {
        name?: string;
        email?: string;
        address?: string;
        contact_person?: string;
        phone?: string;
      } = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (
          path === "name" ||
          path === "email" ||
          path === "address" ||
          path === "contact_person" ||
          path === "phone"
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

      // Reset form
      setName("");
      setEmail("");
      setAddress("");
      setContactPerson("");
      setPhone("");
      setErrors({});
      onOpenChange(false);
      await onSuccess(validatedData, location?.id);
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
      setErrors({});
    }
  }, [open, location]);

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
