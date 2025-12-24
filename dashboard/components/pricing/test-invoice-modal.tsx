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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { InvoiceService } from "@/lib/services/invoice.service";
import { JobsService } from "@/lib/services/jobs.service";
import type { FieldConfig } from "@clean-log/shared/types";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface TestInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TestInvoiceModal({
  open,
  onOpenChange,
}: TestInvoiceModalProps) {
  const { organizationId } = useOrganization();
  const { fieldConfigs, loading: fieldsLoading } = useFieldConfigs();
  const { locations, loading: locationsLoading } = useLocations();
  const { workers, loading: workersLoading } = useWorkers();
  const { formatCurrency } = useOrganizationCurrency();

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [calculation, setCalculation] = useState<{
    total: number;
    subtotal: number;
    total_adjustments: number;
    total_worker_payment: number;
    margin: number;
    line_items: Array<{
      field_name: string;
      field_label: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>;
  } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "preview" | "result">(
    "input"
  );

  // Get fields that should be shown in the form (exclude system fields and complex types)
  const formFields = useMemo(() => {
    return fieldConfigs.filter(
      (field) =>
        !field.name.startsWith("_") && field.field_type !== "grouped_breakdown" // Skip grouped_breakdown for simplicity
    );
  }, [fieldConfigs]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedLocationId("");
      setFieldValues({});
      setCalculation(null);
      setCreatedJobId(null);
      setCreatedInvoiceId(null);
      setActiveTab("input");
    }
  }, [open]);

  // Calculate invoice for a job
  const calculateInvoice = useCallback(
    async (jobId: string) => {
      if (!organizationId) {
        return;
      }

      try {
        setCalculating(true);
        const result = await InvoiceService.calculate({
          organization_id: organizationId,
          job_ids: [jobId],
        });

        if (result.job_calculations.length > 0) {
          const calc = result.job_calculations[0];
          setCalculation({
            total: calc.total,
            subtotal: calc.subtotal,
            total_adjustments: calc.total_adjustments,
            total_worker_payment: calc.worker_payment_total,
            margin: calc.margin,
            line_items: calc.line_items,
          });
          setActiveTab("preview");
        }
      } catch (err) {
        log.error("Failed to calculate test invoice", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
        toast.error(
          "Failed to calculate invoice. Please check your pricing configuration."
        );
      } finally {
        setCalculating(false);
      }
    },
    [organizationId]
  );

  // Create test job
  const handleCreateTestJob = useCallback(async () => {
    if (!organizationId || !selectedLocationId) {
      toast.error("Please select a location");
      return;
    }

    if (workers.length === 0) {
      toast.error(
        "No workers available. Please add at least one worker first."
      );
      return;
    }

    try {
      setCreatingJob(true);

      // Build submission data with test flag
      // Convert field values to proper format (grouped_breakdown should be arrays)
      const submissionData: Record<string, unknown> = {
        _is_test: true,
        _test_created_at: new Date().toISOString(),
      };

      // Process field values according to their types
      formFields.forEach((field) => {
        const value = fieldValues[field.id];
        if (field.field_type === "grouped_breakdown") {
          // Ensure grouped_breakdown is always an array
          submissionData[field.name] = Array.isArray(value) ? value : [];
        } else if (field.field_type === "time") {
          // Ensure time is always a string in HH:mm format
          if (typeof value === "string" && value !== "") {
            submissionData[field.name] = value;
          } else {
            // If no value, use current time
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, "0");
            const minutes = now.getMinutes().toString().padStart(2, "0");
            submissionData[field.name] = `${hours}:${minutes}`;
          }
        } else {
          submissionData[field.name] = value ?? (field.required ? null : "");
        }
      });

      // Create test job
      const jobResponse = await JobsService.create({
        organization_id: organizationId,
        location_id: selectedLocationId,
        worker_ids: [workers[0].id], // Use first available worker
        submission_data: submissionData,
        completed_at: new Date().toISOString(),
      });

      if (!jobResponse.job) {
        throw new Error("Failed to create test job");
      }

      const jobId = jobResponse.job.id;
      setCreatedJobId(jobId);
      toast.success("Test job created successfully");

      // Calculate invoice
      await calculateInvoice(jobId);
    } catch (err) {
      log.error("Failed to create test job", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create test job. Please try again."
      );
    } finally {
      setCreatingJob(false);
    }
  }, [
    organizationId,
    selectedLocationId,
    fieldValues,
    workers,
    calculateInvoice,
    formFields,
  ]);

  // Create invoice from test job
  const handleCreateInvoice = useCallback(async () => {
    if (!organizationId || !createdJobId) {
      return;
    }

    try {
      setCreatingJob(true);
      // Calculate due date (30 days from now by default)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateString = dueDate.toISOString().split("T")[0];

      const invoice = await InvoiceService.create({
        organization_id: organizationId,
        job_ids: [createdJobId],
        due_date: dueDateString,
      });

      setCreatedInvoiceId(invoice.id);
      setActiveTab("result");
      toast.success("Invoice created successfully!");
    } catch (err) {
      log.error("Failed to create invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create invoice. Please try again."
      );
    } finally {
      setCreatingJob(false);
    }
  }, [organizationId, createdJobId]);

  // Render field input based on field type
  const renderFieldInput = (field: FieldConfig) => {
    const value = fieldValues[field.id] ?? "";

    switch (field.field_type) {
      case "text":
      case "textarea":
        return (
          <Input
            id={field.id}
            value={value as string}
            onChange={(e) =>
              setFieldValues((prev) => ({
                ...prev,
                [field.id]: e.target.value,
              }))
            }
            placeholder={
              field.description || `Enter ${field.label.toLowerCase()}`
            }
          />
        );

      case "number":
        return (
          <Input
            id={field.id}
            type="number"
            value={value as number}
            onChange={(e) =>
              setFieldValues((prev) => ({
                ...prev,
                [field.id]: parseFloat(e.target.value) || 0,
              }))
            }
            placeholder="0"
          />
        );

      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={field.id}
              checked={value === true}
              onChange={(e) =>
                setFieldValues((prev) => ({
                  ...prev,
                  [field.id]: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor={field.id} className="font-normal">
              {field.label}
            </Label>
          </div>
        );

      case "select":
        return (
          <Select
            value={value as string}
            onValueChange={(val) =>
              setFieldValues((prev) => ({ ...prev, [field.id]: val }))
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}`}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "grouped_breakdown":
        // For test purposes, skip grouped_breakdown fields as they require complex input
        // Users can test these through the actual mobile app
        return (
          <div className="text-sm text-muted-foreground italic">
            Grouped breakdown fields are skipped in test mode. Test these
            through the mobile app.
          </div>
        );

      default:
        return (
          <Input
            id={field.id}
            value={value as string}
            onChange={(e) =>
              setFieldValues((prev) => ({
                ...prev,
                [field.id]: e.target.value,
              }))
            }
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  const loading = fieldsLoading || locationsLoading || workersLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Test Invoice
          </DialogTitle>
          <DialogDescription>
            Create a test job with sample data to preview how your invoice will
            look. This helps you validate your pricing configuration before
            going live.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="input">Input Data</TabsTrigger>
            <TabsTrigger value="preview" disabled={!calculation}>
              Invoice Preview
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!createdInvoiceId}>
              Result
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-6 mt-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select
                    value={selectedLocationId}
                    onValueChange={setSelectedLocationId}
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {locations.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No locations available. Please add a location first.
                    </p>
                  )}
                </div>

                {formFields.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Field Values</Label>
                      <p className="text-xs text-muted-foreground">
                        Enter sample values to test your pricing
                      </p>
                    </div>
                    {formFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>
                          {field.label}
                          {field.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        {renderFieldInput(field)}
                        {field.description && (
                          <p className="text-xs text-muted-foreground">
                            {field.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No fields configured yet.</p>
                    <p className="text-sm">
                      Configure fields in Mobile Application settings first.
                    </p>
                  </div>
                )}

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Test Mode</p>
                      <p>
                        This will create a test job marked with a special flag.
                        Test jobs can be filtered and cleaned up separately from
                        real jobs.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            {calculating ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : calculation ? (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(calculation.subtotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Adjustments</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(calculation.total_adjustments)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(calculation.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Worker Payment</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(calculation.total_worker_payment)}
                      </p>
                    </div>
                  </div>
                </div>

                {calculation.line_items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Line Items</h4>
                    <div className="border rounded-lg divide-y">
                      {calculation.line_items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3"
                        >
                          <div>
                            <p className="font-medium">{item.field_label}</p>
                            {item.quantity > 1 && (
                              <p className="text-sm text-muted-foreground">
                                {item.quantity} ×{" "}
                                {formatCurrency(item.unit_price)}
                              </p>
                            )}
                          </div>
                          <p className="font-semibold">
                            {formatCurrency(item.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreateInvoice}
                    disabled={creatingJob}
                    className="flex-1"
                  >
                    {creatingJob ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Invoice...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Create Invoice from Test Job
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Create a test job first to see the invoice preview.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="result" className="mt-4">
            {createdInvoiceId ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Invoice Created Successfully!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        Your test invoice has been created. You can now view it
                        in full detail.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link
                      href={`/dashboard/invoicing?invoice=${createdInvoiceId}`}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Full Invoice
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No invoice created yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Separator />

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {activeTab === "input" && (
              <Button
                onClick={handleCreateTestJob}
                disabled={
                  !selectedLocationId ||
                  workers.length === 0 ||
                  creatingJob ||
                  loading
                }
              >
                {creatingJob ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Test Job...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Create Test Job & Calculate Invoice
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
