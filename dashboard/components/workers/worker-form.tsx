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
import { Switch } from "@/components/ui/switch";
import { shouldSkipEmailVerification } from "@/lib/env";
import { log } from "@/lib/logger";
import { Worker } from "@/lib/types";
import { workerSchema } from "@/lib/validations";
import { useEffect, useState } from "react";

interface WorkerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (
    workerData: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      active?: boolean;
      engagement_type?: "employee" | "contractor";
    },
    workerId?: string
  ) => void | Promise<void>;
  worker?: Worker | null;
  /** When `both`, show engagement type selector */
  workforceEngagement?: "employees" | "contractors" | "both";
}

export default function WorkerForm({
  open,
  onOpenChange,
  onSuccess,
  worker,
  workforceEngagement = "employees",
}: WorkerFormProps) {
  const [firstName, setFirstName] = useState(worker?.first_name || "");
  const [lastName, setLastName] = useState(worker?.last_name || "");
  const [email, setEmail] = useState(worker?.email || "");
  const [phone, setPhone] = useState(worker?.phone || "");
  const [active, setActive] = useState(worker?.active ?? false);
  const [engagementType, setEngagementType] = useState<"employee" | "contractor">(
    worker?.engagement_type === "contractor" ? "contractor" : "employee"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  }>({});

  const isEditMode = !!worker;

  const validateInput = () => {
    log.debug("WorkerForm: Validating form input");

    const result = workerSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    });

    if (!result.success) {
      const fieldErrors: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
      } = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path === "first_name" || path === "last_name" || path === "email" || path === "phone") {
          fieldErrors[path] = issue.message;
        }
      });

      log.warn("WorkerForm: Form validation failed", { errors: fieldErrors });
      setErrors(fieldErrors);
      throw new Error("Validation failed");
    }

    log.debug("WorkerForm: Form validation passed");
    setErrors({});
    return result.data;
  };

  const handleSubmit = async () => {
    try {
      log.info("WorkerForm: Starting worker submission", {
        isEditMode,
        workerId: worker?.id,
      });
      setIsLoading(true);
      setErrors({});

      const validatedData = validateInput();

      // The actual API call is now handled by the parent component
      // We just validate and call onSuccess with the data
      log.info("WorkerForm: Form validated, calling onSuccess", {
        isEditMode,
        workerId: worker?.id,
      });

      const dataToSend = isEditMode
        ? { ...validatedData, active, engagement_type: engagementType }
        : { ...validatedData, engagement_type: engagementType };

      await onSuccess(dataToSend, worker?.id);

      // Only reset/close after a successful mutation
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setActive(false);
      setEngagementType("employee");
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.message !== "Validation failed") {
        log.error("WorkerForm: Submission failed", { error: error.message });
        setErrors({
          email: error.message.includes("email") ? error.message : undefined,
          phone: error.message.includes("phone") ? error.message : undefined,
          first_name:
            error.message.includes("first name") || error.message.includes("first_name")
              ? error.message
              : undefined,
          last_name:
            error.message.includes("last name") || error.message.includes("last_name")
              ? error.message
              : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when dialog opens/closes or worker changes
  useEffect(() => {
    if (open) {
      setFirstName(worker?.first_name || "");
      setLastName(worker?.last_name || "");
      setEmail(worker?.email || "");
      setPhone(worker?.phone || "");
      setActive(worker?.active ?? false);
      setEngagementType(worker?.engagement_type === "contractor" ? "contractor" : "employee");
      setErrors({});
    }
  }, [open, worker]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Worker" : "Add Worker"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update worker information." : "Add a new worker to your organization."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
            {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
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
            {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
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
              placeholder="john@example.com"
              aria-invalid={!!errors.email}
              required
              disabled={isEditMode}
              className={isEditMode ? "bg-muted cursor-not-allowed" : ""}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            {isEditMode && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed after worker creation
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
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
              required
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
          {workforceEngagement === "both" && (
            <div className="space-y-2">
              <Label htmlFor="engagement_type">Engagement type</Label>
              <select
                id="engagement_type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={engagementType}
                onChange={(e) =>
                  setEngagementType(e.target.value === "contractor" ? "contractor" : "employee")
                }
              >
                <option value="employee">Employee</option>
                <option value="contractor">Contractor</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Contractors can submit tax invoices when that feature is enabled.
              </p>
            </div>
          )}
          {isEditMode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="active">Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {worker?.auth_user_id || shouldSkipEmailVerification()
                      ? "Toggle whether this worker is authorized to access the system"
                      : "Worker must accept invitation before they can be activated"}
                  </p>
                  {shouldSkipEmailVerification() && !worker?.auth_user_id && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Dev mode: Email verification bypassed
                    </p>
                  )}
                </div>
                <Switch
                  id="active"
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={!worker?.auth_user_id && !shouldSkipEmailVerification()}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button className="cursor-pointer" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : isEditMode ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
