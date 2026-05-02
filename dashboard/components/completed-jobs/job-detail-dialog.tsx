"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import CalculatePaymentDialog from "@/components/worker-payments/calculate-payment-dialog";
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useWorkerPayments } from "@/hooks/use-worker-payments";
import { useWorkerPaymentHistory } from "@/hooks/use-worker-payment-history";
import type { SaveWorkerPaymentResult } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";

import { log } from "@/lib/logger";
import { InvoiceStatus, Job, JobEdit } from "@/lib/types";
import type { GetJobEditsRequest, UpdateJobRequest } from "@/lib/types/api";
import {
  AlertTriangle,
  Calculator,
  Calendar,
  Clock,
  Mail,
  MapPin,
  Pencil,
  User,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import EditJobDialog from "./edit-job-dialog";

interface JobDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  isAdmin?: boolean;
  onEditSuccess?: () => void;
  updateJob: (request: UpdateJobRequest) => Promise<Job>;
  getJobEdits: (request: GetJobEditsRequest) => Promise<JobEdit[]>;
  sendFeedbackEmail: (jobId: string) => Promise<void>;
  jobs: Job[];
  organizationId: string | null;
  /** Field configs from the page for the edit dialog (avoids useFieldConfigs in nested components). */
  fieldConfigsForEdit: FieldConfig[];
}

// Standard fields that should be displayed in a specific order
const STANDARD_FIELDS = ["start_time", "finish_time", "notes"] as const;

export default function JobDetailDialog({
  open,
  onOpenChange,
  job,
  isAdmin = false,
  onEditSuccess,
  updateJob,
  getJobEdits,
  sendFeedbackEmail,
  jobs,
  organizationId,
  fieldConfigsForEdit,
}: JobDetailDialogProps) {
  const { fieldConfigs, sections } = useMobileConfig(organizationId);
  const { calculatePayments } = useWorkerPayments();
  const { addPayment } = useWorkerPaymentHistory(jobs);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCalculatePaymentDialogOpen, setIsCalculatePaymentDialogOpen] = useState(false);
  const [editHistory, setEditHistory] = useState<JobEdit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Calculate job status
  const jobStatus = useMemo(() => {
    if (!job) return null;
    const invoices = job.invoice_job?.filter((ij) => ij.invoice !== null) || [];

    if (invoices.length === 0) {
      return {
        status: "not_invoiced",
        label: "Not Invoiced",
        variant: "outline" as const,
      };
    }

    const invoice = invoices[0]?.invoice;
    if (!invoice) {
      return {
        status: "not_invoiced",
        label: "Not Invoiced",
        variant: "outline" as const,
      };
    }

    if (invoice.paid_at) {
      return {
        status: "paid",
        label: "Paid",
        variant: "secondary" as const,
      };
    }

    const statusVariants: Record<
      InvoiceStatus,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      draft: "outline",
      pending_review: "outline",
      sent: "default",
      paid: "secondary",
      overdue: "destructive",
      cancelled: "outline",
    };

    // Map status to user-friendly label
    const statusLabels: Record<InvoiceStatus, string> = {
      draft: "Draft",
      pending_review: "Pending Review",
      sent: "Invoice Sent",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    };

    return {
      status: invoice.status,
      label:
        statusLabels[invoice.status] ||
        invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
      variant: statusVariants[invoice.status] || "default",
    };
  }, [job]);

  const invoiceInfo = useMemo(() => {
    if (!job) return null;
    const invoices = job.invoice_job?.filter((ij) => ij.invoice !== null) || [];
    return invoices.length > 0 ? invoices[0]?.invoice : null;
  }, [job]);

  // Extract all unique keys from submission_data
  const submissionDataKeys = useMemo(() => {
    if (!job?.submission_data) return [];
    return Object.keys(job.submission_data);
  }, [job]);

  // Create a map of field config name to field config for quick lookup
  const fieldConfigMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        label: string;
        field_type: string;
        order_position: number;
        section_id: string | null;
      }
    >();
    fieldConfigs.forEach((fc) => {
      map.set(fc.name, {
        id: fc.id,
        name: fc.name,
        label: fc.label,
        field_type: fc.field_type,
        order_position: fc.order_position,
        section_id: fc.section_id,
      });
    });
    return map;
  }, [fieldConfigs]);

  // Order fields based on mobile form structure
  const orderedFields = useMemo(() => {
    if (!job?.submission_data) return [];

    const standard: string[] = [];
    const unsectioned: string[] = [];
    const sectioned: string[] = [];

    // First, collect standard fields
    STANDARD_FIELDS.forEach((field) => {
      if (submissionDataKeys.includes(field)) {
        standard.push(field);
      }
    });

    // Sort sections by order_position
    const sortedSections = [...sections].sort((a, b) => a.order_position - b.order_position);

    // Process fields in section order
    sortedSections.forEach((section) => {
      section.field_ids.forEach((fieldId) => {
        const fieldConfig = fieldConfigs.find((fc) => fc.id === fieldId);
        if (
          fieldConfig &&
          submissionDataKeys.includes(fieldConfig.name) &&
          !STANDARD_FIELDS.includes(fieldConfig.name as (typeof STANDARD_FIELDS)[number])
        ) {
          sectioned.push(fieldConfig.name);
        }
      });
    });

    // Collect unsectioned fields
    submissionDataKeys.forEach((key) => {
      if (STANDARD_FIELDS.includes(key as (typeof STANDARD_FIELDS)[number])) {
        return;
      }
      const fieldConfig = fieldConfigMap.get(key);
      if (!fieldConfig || !fieldConfig.section_id) {
        if (!sectioned.includes(key)) {
          unsectioned.push(key);
        }
      }
    });

    // Sort unsectioned fields by order_position if available
    unsectioned.sort((a, b) => {
      const configA = fieldConfigMap.get(a);
      const configB = fieldConfigMap.get(b);
      if (configA && configB) {
        return configA.order_position - configB.order_position;
      }
      return a.localeCompare(b);
    });

    return [...standard, ...unsectioned, ...sectioned];
  }, [submissionDataKeys, fieldConfigs, sections, fieldConfigMap, job]);

  // Build a map of worker_id -> worker_name from job.workers
  const workerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (job?.workers) {
      job.workers.forEach((w) => {
        map.set(w.id, w.name);
      });
    }
    return map;
  }, [job?.workers]);

  // Helper to format a timestamp in a human-readable way
  const formatTime = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const formatValue = (value: unknown, fieldName?: string): string | React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">Not provided</span>;
    }

    // Handle date/time strings
    if (typeof value === "string") {
      const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      if (dateMatch) {
        try {
          return new Date(value).toLocaleString();
        } catch {
          // Fall through to string handling
        }
      }
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground italic">None</span>;
      }

      // Handle worker_times array: [{ worker_id, start_time, finish_time }, ...]
      if (
        fieldName === "worker_times" &&
        value.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "worker_id" in item &&
            ("start_time" in item || "finish_time" in item)
        )
      ) {
        return (
          <div className="space-y-2">
            {value.map(
              (
                item: {
                  worker_id: string;
                  start_time?: string;
                  finish_time?: string;
                },
                idx: number
              ) => {
                const workerName = workerNameMap.get(item.worker_id) || "Unknown Worker";
                return (
                  <div key={idx} className="text-sm border-l-2 border-muted pl-2">
                    <div className="font-medium">{workerName}</div>
                    {item.start_time && (
                      <div className="text-muted-foreground">
                        Start: {formatTime(item.start_time)}
                      </div>
                    )}
                    {item.finish_time && (
                      <div className="text-muted-foreground">
                        Finish: {formatTime(item.finish_time)}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        );
      }

      // Handle arrays of objects (like grouped breakdown)
      if (
        value.every(
          (item) =>
            typeof item === "object" && item !== null && "brand" in item && "quantity" in item
        )
      ) {
        return (
          <div className="space-y-1">
            {value.map((item: { brand: string; quantity: number }, idx: number) => (
              <div key={idx} className="text-sm">
                <span className="font-medium">{item.brand}:</span> {item.quantity}
              </div>
            ))}
          </div>
        );
      }
      return value.map((item, idx) => (
        <div key={idx} className="text-sm">
          {typeof item === "object" && item !== null ? JSON.stringify(item, null, 2) : String(item)}
        </div>
      ));
    }

    if (typeof value === "object" && value !== null) {
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return String(value);
  };

  const formatFieldLabel = (key: string): string => {
    const fieldConfig = fieldConfigMap.get(key);
    if (fieldConfig) {
      return fieldConfig.label;
    }
    return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Fetch edit history when dialog opens
  useEffect(() => {
    if (!open || !job) {
      return;
    }

    let cancelled = false;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const edits = await getJobEdits({ job_id: job.id });
        if (!cancelled) {
          setEditHistory(edits || []);
        }
      } catch (err) {
        // Silently handle errors - edit history is optional
        // This prevents errors from breaking the dialog if migration hasn't been run
        if (!cancelled) {
          log.warn("JobDetailDialog: Failed to fetch edit history (optional)", {
            error: err instanceof Error ? err.message : "Unknown error",
            jobId: job.id,
          });
          setEditHistory([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [open, job, getJobEdits]);

  if (!job) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Job Details</DialogTitle>
                <DialogDescription>
                  Completed on {new Date(job.completed_at).toLocaleString()}
                </DialogDescription>
                {jobStatus && (
                  <Badge variant={jobStatus.variant} className="mt-2">
                    {jobStatus.label}
                  </Badge>
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  {job.workers.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCalculatePaymentDialogOpen(true);
                      }}
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      Calculate Payment
                    </Button>
                  )}
                  {!job.feedback_email_sent && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!job.id) return;
                        setSendingFeedback(true);
                        try {
                          await sendFeedbackEmail(job.id);
                          toast.success("Feedback email sent successfully", {
                            description: "The feedback request has been emailed to the customer.",
                          });
                          onEditSuccess?.();
                        } catch (err) {
                          log.error("JobDetailDialog: Failed to send feedback email", {
                            error: err instanceof Error ? err.message : "Unknown error",
                            jobId: job.id,
                          });
                          toast.error("Failed to send feedback email", {
                            description: err instanceof Error ? err.message : "Please try again.",
                          });
                        } finally {
                          setSendingFeedback(false);
                        }
                      }}
                      disabled={sendingFeedback}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {sendingFeedback ? "Sending..." : "Send Feedback Email"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Job
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Warning banner for invoiced jobs */}
            {invoiceInfo && (
              <div className="rounded-md bg-warning/5 border border-warning/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-warning mb-1">
                      This job is included in an invoice
                    </h4>
                    <p className="text-sm text-warning/80">
                      Invoice <strong>{invoiceInfo.invoice_number}</strong> (Status:{" "}
                      {invoiceInfo.status})
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </div>
                  <div className="text-base">
                    {job.location ? (
                      job.location.name
                    ) : (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Workers
                  </div>
                  <div className="text-base">
                    {job.workers.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {job.workers.map((worker) => (
                          <span key={worker.id}>{worker.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">No workers assigned</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Completed At
                  </div>
                  <div className="text-base">{new Date(job.completed_at).toLocaleString()}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Feedback Status
                  </div>
                  <div className="text-base">
                    {job.feedback_email_sent ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary">Feedback Email Sent</Badge>
                        {job.feedback_email_sent_at && (
                          <span className="text-xs text-muted-foreground">
                            Sent on {new Date(job.feedback_email_sent_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : job.feedback_token ? (
                      <Badge variant="outline">Feedback Pending</Badge>
                    ) : (
                      <span className="text-muted-foreground italic">
                        No feedback token generated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Job Data Fields */}
            {orderedFields.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Job Data</h3>
                <div className="space-y-4">
                  {orderedFields.map((key) => {
                    const value = job.submission_data?.[key];
                    return (
                      <div key={key} className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground">
                          {formatFieldLabel(key)}
                        </div>
                        <div className="text-base">{formatValue(value, key)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {orderedFields.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No job data available</div>
            )}
          </div>

          {/* Edit History */}
          {isAdmin && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Edit History
                </h3>
                {loadingHistory ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading edit history...
                  </div>
                ) : editHistory.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No edits recorded</div>
                ) : (
                  <div className="space-y-3">
                    {editHistory.map((edit) => (
                      <div key={edit.id} className="rounded-md border p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{edit.edited_by_email}</span>
                            <Badge variant="outline" className="text-xs">
                              {edit.action}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(edit.changed_at).toLocaleString()}
                          </span>
                        </div>
                        {edit.changed_fields.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Changed: {edit.changed_fields.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <>
          <EditJobDialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                // Keep detail dialog open when edit dialog closes
              }
            }}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              onEditSuccess?.();
              // Optionally close detail dialog after successful edit
              // onOpenChange(false);
            }}
            job={job}
            updateJob={updateJob}
            organizationId={organizationId}
            fieldConfigs={fieldConfigsForEdit}
          />
          {job && job.workers.length > 0 && (
            <CalculatePaymentDialog
              open={isCalculatePaymentDialogOpen}
              onOpenChange={setIsCalculatePaymentDialogOpen}
              onCalculate={async (
                jobIds,
                options
              ): Promise<SaveWorkerPaymentResult | undefined> => {
                if (!organizationId) return undefined;
                const result = await calculatePayments(jobIds);
                if (!result?.calculation) return undefined;
                const outcome = await WorkerPaymentService.savePayment(
                  organizationId,
                  result,
                  jobIds,
                  options
                );
                if (outcome.ok) {
                  addPayment(result, jobIds);
                }
                return outcome;
              }}
              preselectedJobIds={[job.id]}
              jobs={jobs}
            />
          )}
        </>
      )}
    </>
  );
}
