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
import { useEffect, useState } from "react";

interface OrganizationUserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (
    userData: {
      email?: string;
      role: "admin" | "viewer";
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
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState<"admin" | "viewer">(user?.role || "viewer");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    role?: string;
  }>({});

  const isEditMode = !!user;

  const validateInput = () => {
    log.debug("OrganizationUserForm: Validating form input");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!isEditMode && (!email || !emailRegex.test(email))) {
      setErrors({ email: "Please enter a valid email address" });
      throw new Error("Validation failed");
    }

    if (!role || (role !== "admin" && role !== "viewer")) {
      setErrors({ role: "Please select a valid role" });
      throw new Error("Validation failed");
    }

    log.debug("OrganizationUserForm: Form validation passed");
    setErrors({});
    return { email: email.trim(), role };
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

      // Reset form
      if (!isEditMode) {
        setEmail("");
      }
      setRole("viewer");
      setErrors({});
      onOpenChange(false);

      const dataToSend = isEditMode
        ? { role: validatedData.role }
        : { email: validatedData.email, role: validatedData.role };

      await onSuccess(dataToSend, user?.id);
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
      setEmail(user?.email || "");
      setRole(user?.role || "viewer");
      setErrors({});
    }
  }, [open, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Dashboard User" : "Add Dashboard User"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update user role. Email cannot be changed."
              : "Add a new dashboard user to your organization. They will need to set up their password."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
            {isLoading ? "Saving..." : isEditMode ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
