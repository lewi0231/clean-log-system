"use client";

import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { InvoiceStatus, Job, JobEdit } from "@/lib/types";
import type { GetJobEditsRequest, UpdateJobRequest } from "@/lib/types/api";
import { CheckCircle2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import JobDetailDialog from "./job-detail-dialog";

interface CompletedJobsListProps {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  isAdmin?: boolean;
  onJobUpdated?: () => void;
  updateJob: (request: UpdateJobRequest) => Promise<Job>;
  getJobEdits: (request: GetJobEditsRequest) => Promise<JobEdit[]>;
  sendFeedbackEmail: (jobId: string) => Promise<void>;
  organizationId: string | null;
}

// Standard fields that should be displayed in a specific order
const STANDARD_FIELDS = ["start_time", "finish_time", "notes"] as const;

export default function CompletedJobsList({
  jobs,
  loading,
  error,
  isAdmin = false,
  onJobUpdated,
  updateJob,
  getJobEdits,
  sendFeedbackEmail,
  organizationId,
}: CompletedJobsListProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { fieldConfigs, sections } = useMobileConfig(organizationId);

  // Extract all unique keys from submission_data across all jobs
  const submissionDataKeys = useMemo(() => {
    const keys = new Set<string>();
    jobs.forEach((job) => {
      if (job.submission_data) {
        Object.keys(job.submission_data).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [jobs]);

  // Create a map of field config name to field config for quick lookup
  const fieldConfigMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        field_type: string;
        order_position: number;
        section_id: string | null;
      }
    >();
    fieldConfigs.forEach((fc) => {
      map.set(fc.name, {
        id: fc.id,
        name: fc.name,
        field_type: fc.field_type,
        order_position: fc.order_position,
        section_id: fc.section_id,
      });
    });
    return map;
  }, [fieldConfigs]);

  // Order fields based on mobile form structure:
  // 1. Standard fields (start_time, finish_time, notes) in that order
  // 2. Fields without sections (sorted by order_position)
  // 3. Fields within sections (sections sorted by order_position, fields within section by field_ids order)
  const orderedFields = useMemo(() => {
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
    const sortedSections = [...sections].sort(
      (a, b) => a.order_position - b.order_position,
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
        // Find the field config by ID
        const fieldConfig = fieldConfigs.find((fc) => fc.id === fieldId);
        if (
          fieldConfig &&
          submissionDataKeys.includes(fieldConfig.name) &&
          !STANDARD_FIELDS.includes(
            fieldConfig.name as (typeof STANDARD_FIELDS)[number],
          )
        ) {
          // Only add if not already in standard fields
          sectioned.push(fieldConfig.name);
        }
      });
    });

    // Collect unsectioned fields
    submissionDataKeys.forEach((key) => {
      if (STANDARD_FIELDS.includes(key as (typeof STANDARD_FIELDS)[number])) {
        return; // Skip standard fields, already handled
      }
      const fieldConfig = fieldConfigMap.get(key);
      if (!fieldConfig || !fieldConfig.section_id) {
        // Field is not in a section or doesn't exist in config
        if (!sectioned.includes(key)) {
          unsectioned.push(key);
        }
      }
    });

    // Sort unsectioned fields by order_position if available, otherwise alphabetically
    unsectioned.sort((a, b) => {
      const configA = fieldConfigMap.get(a);
      const configB = fieldConfigMap.get(b);
      if (configA && configB) {
        return configA.order_position - configB.order_position;
      }
      return a.localeCompare(b);
    });

    return [...standard, ...unsectioned, ...sectioned];
  }, [submissionDataKeys, fieldConfigs, sections, fieldConfigMap]);

  const formatValue = (
    value: unknown,
    fieldExists: boolean,
    fieldName?: string,
  ): string | React.ReactNode => {
    // If field doesn't exist in this job's submission_data, show N/A indicator
    if (!fieldExists) {
      return <span className="text-muted-foreground italic text-xs">-</span>;
    }

    if (value === null || value === undefined) {
      return "-";
    }

    // Handle boolean values (check before string to catch actual booleans)
    // Also handle string "true"/"false" which can occur in JSON
    if (typeof value === "boolean") {
      return value ? (
        <CheckCircle2
          className="h-4 w-4 text-green-600 mx-auto"
          aria-label="Yes"
        />
      ) : (
        <span className="text-muted-foreground text-center">-</span>
      );
    }

    // Handle string "true"/"false" values (can occur when JSON stores booleans as strings)
    if (typeof value === "string" && (value === "true" || value === "false")) {
      return value === "true" ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Yes" />
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    }

    // Handle empty string for boolean fields (legacy data - should be treated as false)
    if (typeof value === "string" && value === "" && fieldName) {
      const fieldConfig = fieldConfigMap.get(fieldName);
      if (fieldConfig?.field_type === "boolean") {
        return <span className="text-muted-foreground">-</span>;
      }
    }

    // Check for number 1/0 (legacy data format)
    if (typeof value === "number" && (value === 1 || value === 0)) {
      return value === 1 ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Yes" />
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    }

    // Check for capitalized True/False (legacy data format)
    if (typeof value === "string" && (value === "True" || value === "False")) {
      return value === "True" ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Yes" />
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    }

    // Handle date/time strings
    if (typeof value === "string") {
      // Check if it's an ISO date string
      const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      if (dateMatch) {
        try {
          return new Date(value).toLocaleString();
        } catch {
          // Fall through to string handling
        }
      }
    }
    if (Array.isArray(value)) {
      // Handle arrays of objects (like grouped breakdown)
      if (value.length === 0) {
        return "-";
      }
      // Check if it's an array of objects with brand/quantity structure
      if (
        value.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "brand" in item &&
            "quantity" in item,
        )
      ) {
        // Format as "Option: Quantity, Option: Quantity"
        return value
          .map((item: { brand: string; quantity: number }) => {
            return `${item.brand}: ${item.quantity}`;
          })
          .join(", ");
      }
      // For other arrays, format each item
      return value
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            // Format object as key: value pairs
            return `{${Object.entries(item)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")}}`;
          }
          return String(item);
        })
        .join(", ");
    }
    if (typeof value === "object" && value !== null) {
      // Format object as key: value pairs
      return `{${Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")}}`;
    }
    return String(value);
  };

  const formatColumnHeader = (key: string): string => {
    return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Calculate feedback status
  const getFeedbackStatus = (
    job: Job,
  ): {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  } | null => {
    // If feedback has been received, show "Feedback Received"
    if (job.has_feedback) {
      return {
        label: "Feedback Received",
        variant: "secondary",
      };
    }
    // If feedback email has been sent but not received yet, show "Feedback Sent"
    if (job.feedback_email_sent) {
      return {
        label: "Feedback Sent",
        variant: "secondary",
      };
    }
    if (job.feedback_token) {
      return {
        label: "Feedback Pending",
        variant: "outline",
      };
    }
    return null;
  };

  // Calculate job status from invoice data
  const getJobStatus = (
    job: Job,
  ): {
    status: "not_invoiced" | InvoiceStatus;
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  } => {
    const invoices = job.invoice_job?.filter((ij) => ij.invoice !== null) || [];

    if (invoices.length === 0) {
      return {
        status: "not_invoiced",
        label: "Not Invoiced",
        variant: "outline",
      };
    }

    // Get the most recent invoice (if multiple, use the first one)
    const invoice = invoices[0]?.invoice;
    if (!invoice) {
      return {
        status: "not_invoiced",
        label: "Not Invoiced",
        variant: "outline",
      };
    }

    // Check if paid
    if (invoice.paid_at) {
      return {
        status: "paid",
        label: "Paid",
        variant: "secondary",
      };
    }

    // Map invoice status to badge variant
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
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={6} />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error: {error}</div>
    );
  }

  // Column order: Status, Location, Workers, Ordered Fields, Submitted By, Completed At
  const totalColumns = 2 + orderedFields.length + 3; // Status, Location, Workers, ordered fields, Submitted By, Completed At

  return (
    <div className="w-full overflow-x-auto">
      <div className="rounded-md border min-w-full">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Status</TableHead>
              <TableHead className="min-w-[120px]">Location</TableHead>
              <TableHead className="min-w-[120px]">Workers</TableHead>
              {orderedFields.map((key) => (
                <TableHead
                  key={key}
                  className={
                    key === "notes"
                      ? "min-w-[200px]"
                      : "min-w-[120px] text-center"
                  }
                >
                  {formatColumnHeader(key)}
                </TableHead>
              ))}
              <TableHead className="min-w-[150px]">Submitted By</TableHead>
              <TableHead className="min-w-[150px]">Completed At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-8">
                  No completed jobs found.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedJob(job)}
                >
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {job.is_test && (
                        <Badge
                          variant="destructive"
                          className="w-fit text-[10px] tracking-wide"
                        >
                          TEST
                        </Badge>
                      )}
                      <Badge variant={getJobStatus(job).variant}>
                        {getJobStatus(job).label}
                      </Badge>
                      {getFeedbackStatus(job) && (
                        <Badge
                          variant={getFeedbackStatus(job)!.variant}
                          className="text-xs"
                        >
                          {getFeedbackStatus(job)!.label}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="mx-auto">
                    {job.location ? job.location.name : "-"}
                  </TableCell>
                  <TableCell className="text-left">
                    {job.workers.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {job.workers.map((worker) => (
                          <span key={worker.id}>{worker.name}</span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  {orderedFields.map((key) => {
                    const fieldExists = key in (job.submission_data || {});
                    const value = job.submission_data?.[key];
                    return (
                      <TableCell
                        key={key}
                        className={
                          key === "notes"
                            ? "max-w-[300px] whitespace-normal"
                            : "text-center"
                        }
                      >
                        {formatValue(value, fieldExists, key)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-sm text-muted-foreground">
                    {job.submitted_by_email || "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {new Date(job.completed_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <JobDetailDialog
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
          }
        }}
        job={selectedJob}
        isAdmin={isAdmin}
        onEditSuccess={() => {
          onJobUpdated?.();
        }}
        updateJob={updateJob}
        getJobEdits={getJobEdits}
        sendFeedbackEmail={sendFeedbackEmail}
        jobs={jobs}
        organizationId={organizationId}
      />
    </div>
  );
}
