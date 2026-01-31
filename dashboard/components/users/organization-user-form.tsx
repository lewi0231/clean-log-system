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
import { log } from "@/lib/logger";
import { OrganizationUser } from "@/lib/types";
import { organizationUserSchema } from "@/lib/validations";
import { useEffect, useState } from "react";

interface OrganizationUserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (
    userData: {
      email?: string;
      role: "admin" | "viewer";
      first_name?: string;
      last_name?: string;
      phone?: string | null;
    },
    userId?: string
  ) => void | Promise<void>;
  user?: OrganizationUser | null;
}

export default function OrganizationUserForm({
  open,
  onOpenChange,
  onSuccess,
  user,
}: OrganizationUserFormProps) {
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [role, setRole] = useState<"admin" | "viewer">(user?.role || "viewer");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    role?: string;
  }>({});

  const isEditMode = !!user;

  const validateInput = () => {
    log.debug("OrganizationUserForm: Validating form input");

    const result = organizationUserSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      role,
    });

    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof typeof errors;
        if (path) {
          fieldErrors[path] = issue.message;
        }
      });
      log.warn("OrganizationUserForm: Form validation failed", {
        errors: fieldErrors,
      });
      setErrors(fieldErrors);
      throw new Error("Validation failed");
    }

    log.debug("OrganizationUserForm: Form validation passed");
    setErrors({});
    return result.data;
  };

  const handleSubmit = async () => {
    try {
      log.info("OrganizationUserForm: Starting user submission", {
        isEditMode,
        userId: user?.id,
      });
      setIsLoading(true);
      setErrors({});

      const validatedData = validateInput();

      log.info("OrganizationUserForm: Form validated, calling onSuccess", {
        isEditMode,
        userId: user?.id,
      });

      const dataToSend = isEditMode
        ? {
            role: validatedData.role,
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            phone: validatedData.phone,
          }
        : {
            email: validatedData.email,
            role: validatedData.role,
            first_name: validatedData.first_name,
            last_name: validatedData.last_name,
            phone: validatedData.phone,
          };

      await onSuccess(dataToSend, user?.id);

      // Only reset/close after a successful mutation
      if (!isEditMode) {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setRole("viewer");
      }
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.message !== "Validation failed") {
        log.error("OrganizationUserForm: Submission failed", {
          error: error.message,
        });
        setErrors({
          email: error.message.includes("email") ? error.message : undefined,
          role: error.message.includes("role") ? error.message : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      setFirstName(user?.first_name || "");
      setLastName(user?.last_name || "");
      setEmail(user?.email || "");
      setPhone(user?.phone || "");
      setRole(user?.role || "viewer");
      setErrors({});
    }
  }, [open, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Dashboard User" : "Invite Dashboard User"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update user information. Email cannot be changed."
              : "Invite a new dashboard user to your organization. They will receive an email to set up their account."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                name="first_name"
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.first_name) {
                    setErrors((prev) => ({ ...prev, first_name: undefined }));
                  }
                }}
                placeholder="John"
                aria-invalid={!!errors.first_name}
                required
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                name="last_name"
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.last_name) {
                    setErrors((prev) => ({ ...prev, last_name: undefined }));
                  }
                }}
                placeholder="Doe"
                aria-invalid={!!errors.last_name}
                required
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
              placeholder="user@example.com"
              aria-invalid={!!errors.email}
              required={!isEditMode}
              disabled={isEditMode}
              className={isEditMode ? "bg-muted cursor-not-allowed" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
            {isEditMode && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed after user creation
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone Number{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
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
              placeholder="+1 555 123 4567"
              aria-invalid={!!errors.phone}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value as "admin" | "viewer");
                if (errors.role) {
                  setErrors((prev) => ({ ...prev, role: undefined }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Admin users can manage all settings and users. Viewer users can
              only view data.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? "Saving..."
              : isEditMode
                ? "Update"
                : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
