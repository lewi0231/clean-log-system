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
import { workerSchema } from "@/lib/validations";
import { useEffect, useState } from "react";

interface WorkerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (
    workerData: { name: string; email: string; phone: string },
    workerId?: string
  ) => void | Promise<void>;
  worker?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export default function WorkerForm({
  open,
  onOpenChange,
  onSuccess,
  worker,
}: WorkerFormProps) {
  const [name, setName] = useState(worker?.name || "");
  const [email, setEmail] = useState(worker?.email || "");
  const [phone, setPhone] = useState(worker?.phone || "");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});

  const isEditMode = !!worker;

  const validateInput = () => {
    log.debug("WorkerForm: Validating form input");

    const result = workerSchema.safeParse({
      name,
      email,
      phone,
    });

    if (!result.success) {
      const fieldErrors: {
        name?: string;
        email?: string;
        phone?: string;
      } = {};

      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path === "name" || path === "email" || path === "phone") {
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

      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setErrors({});
      onOpenChange(false);
      await onSuccess(validatedData, worker?.id);
    } catch (error) {
      if (error instanceof Error && error.message !== "Validation failed") {
        log.error("WorkerForm: Submission failed", { error: error.message });
        setErrors({
          email: error.message.includes("email") ? error.message : undefined,
          phone: error.message.includes("phone") ? error.message : undefined,
          name: error.message.includes("name") ? error.message : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when dialog opens/closes or worker changes
  useEffect(() => {
    if (open) {
      setName(worker?.name || "");
      setEmail(worker?.email || "");
      setPhone(worker?.phone || "");
      setErrors({});
    }
  }, [open, worker]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Worker" : "Add Worker"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update worker information."
              : "Add a new worker to your organization."}
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
              placeholder="John Doe"
              aria-invalid={!!errors.name}
              required
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
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
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
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
