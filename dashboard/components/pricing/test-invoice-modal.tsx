"use client";

import { FieldRenderer } from "@/components/shared/field-renderer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { InvoiceService } from "@/lib/services/invoice.service";
import { JobsService } from "@/lib/services/jobs.service";
import { validateFields } from "@/lib/utils/field-validation";
import { buildSubmissionData } from "@/lib/utils/submission-data-builder";
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
  const { sections } = useMobileConfig(organizationId);
  const { locations, loading: locationsLoading } = useLocations();
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const { workers, loading: workersLoading } = useWorkers();
  const { formatCurrency } = useOrganizationCurrency();

  // Location is only required if use_predefined_locations is enabled
  const isLocationRequired = settings?.use_predefined_locations ?? true;

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | number | boolean | string[]>
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
  // Order fields to match mobile config: sections sorted by order_position, fields within sections by field_ids order, then unsectioned fields by order_position
  const formFields = useMemo(() => {
    const allFields = fieldConfigs.filter(
      (field) =>
        !field.name.startsWith("_") && field.field_type !== "grouped_breakdown" // Skip grouped_breakdown for simplicity
    );

    // Create a map of section_id to fields
    const sectionedFields: FieldConfig[] = [];
    const unsectionedFields: FieldConfig[] = [];

    // Sort sections by order_position
    const sortedSections = [...sections].sort(
      (a, b) => a.order_position - b.order_position
    );

    // Create a set of all field IDs that are in sections
    const sectionedFieldIds = new Set<string>();
    sortedSections.forEach((section) => {
      section.field_ids.forEach((fieldId) => {
        sectionedFieldIds.add(fieldId);
      });
    });

    // Process fields in section order
    sortedSections.forEach((section) => {
      // Process fields in the order specified by field_ids
      section.field_ids.forEach((fieldId) => {
        const fieldConfig = allFields.find((fc) => fc.id === fieldId);
        if (fieldConfig) {
          sectionedFields.push(fieldConfig);
        }
      });
    });

    // Collect unsectioned fields and sort by order_position
    allFields.forEach((field) => {
      if (!sectionedFieldIds.has(field.id)) {
        unsectionedFields.push(field);
      }
    });
    unsectionedFields.sort((a, b) => a.order_position - b.order_position);

    // Return: sectioned fields first, then unsectioned fields
    return [...sectionedFields, ...unsectionedFields];
  }, [fieldConfigs, sections]);

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
    if (!organizationId) {
      toast.error("Organization not found");
      return;
    }

    // Only require location if use_predefined_locations is enabled
    if (isLocationRequired && !selectedLocationId) {
      toast.error("Please select a location");
      return;
    }

    // Workers are optional - for sole traders, the admin user may be the only worker
    // and they might not have workers set up yet

    try {
      setCreatingJob(true);

      // Build submission data with test flag
      // Convert field values to proper format (grouped_breakdown should be arrays)
      const submissionData: Record<string, unknown> = {
        _is_test: true,
        _test_created_at: new Date().toISOString(),
      };

      // Validate required fields using shared utility
      const validationErrors = validateFields(formFields, fieldValues);
      if (Object.keys(validationErrors).length > 0) {
        const missingFields = Object.values(validationErrors);
        toast.error(
          `Please fill in required fields: ${missingFields.join(", ")}`
        );
        return;
      }

      // Build submission data using shared utility
      const builtSubmissionData = buildSubmissionData(formFields, fieldValues);
      Object.assign(submissionData, builtSubmissionData);

      // Create test job
      // Use first available worker if any exist, otherwise pass empty array (workers are optional)
      const workerIds = workers.length > 0 ? [workers[0].id] : [];

      const jobResponse = await JobsService.create({
        organization_id: organizationId,
        location_id: isLocationRequired ? selectedLocationId : null,
        worker_ids: workerIds.length > 0 ? workerIds : undefined,
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
    isLocationRequired,
  ]);

  // Create invoice from test job
  const handleCreateInvoice = useCallback(async () => {
    if (!organizationId || !createdJobId) {
      return;
    }

    try {
      setCreatingJob(true);
      // Calculate due date (30 days from now by default)
      // API expects ISO 8601 datetime string, not just date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateString = dueDate.toISOString();

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
        jobId: createdJobId,
      });

      // Provide more helpful error message
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (
        errorMessage.includes("already") ||
        errorMessage.includes("invoiced")
      ) {
        toast.error(
          "This test job has already been invoiced. Please create a new test job to generate another invoice."
        );
      } else {
        toast.error(
          errorMessage || "Failed to create invoice. Please try again."
        );
      }
    } finally {
      setCreatingJob(false);
    }
  }, [organizationId, createdJobId]);

  // Use shared field renderer component

  const loading =
    fieldsLoading || locationsLoading || workersLoading || settingsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
          className="flex flex-col flex-1 min-h-0"
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

          <TabsContent
            value="input"
            className="space-y-6 mt-4 flex-1 overflow-y-auto pr-1"
          >
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {/* Location Selection - Only show if use_predefined_locations is enabled */}
                {isLocationRequired && (
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
                    <Label htmlFor="location" className="text-sm font-medium">
                      Location
                      {isLocationRequired && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
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
                      <p className="text-sm text-muted-foreground mt-1">
                        No locations available. Please add a location first.
                      </p>
                    )}
                  </div>
                )}

                {formFields.length > 0 ? (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-base font-semibold">
                        Field Values
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enter sample values to test your pricing configuration
                      </p>
                    </div>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                      {formFields.map((field) => (
                        <div
                          key={field.id}
                          className="space-y-2 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <FieldRenderer
                            field={field}
                            value={fieldValues[field.id]}
                            onChange={(val) =>
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.id]: val,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium mb-1">No fields configured yet</p>
                    <p className="text-sm">
                      Configure fields in Mobile Application settings first.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 p-4 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
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

          <TabsContent
            value="preview"
            className="mt-4 flex-1 overflow-y-auto pr-1"
          >
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
                    {/* Only show worker payment if there are workers and payment is set */}
                    {workers.length > 0 &&
                      calculation.total_worker_payment > 0 && (
                        <div>
                          <p className="text-muted-foreground">
                            Worker Payment
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(calculation.total_worker_payment)}
                          </p>
                        </div>
                      )}
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
                    className="flex-1 cursor-pointer"
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

          <TabsContent
            value="result"
            className="mt-4 flex-1 overflow-y-auto pr-1"
          >
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
                  (isLocationRequired && !selectedLocationId) ||
                  creatingJob ||
                  loading
                }
                className="cursor-pointer"
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
