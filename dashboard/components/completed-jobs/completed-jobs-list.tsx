"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Job } from "@/lib/types";
import { useMemo } from "react";

interface CompletedJobsListProps {
  jobs: Job[];
  loading: boolean;
  error: string | null;
}

export default function CompletedJobsList({
  jobs,
  loading,
  error,
}: CompletedJobsListProps) {
  // Extract all unique keys from submission_data across all jobs
  const submissionDataKeys = useMemo(() => {
    const keys = new Set<string>();
    jobs.forEach((job) => {
      if (job.submission_data) {
        Object.keys(job.submission_data).forEach((key) => keys.add(key));
      }
    });
    // Sort keys for consistent column order
    return Array.from(keys).sort();
  }, [jobs]);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "-";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
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
            "quantity" in item
        )
      ) {
        // Format as "Brand: Quantity, Brand: Quantity"
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

  if (loading) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">Error: {error}</div>
    );
  }

  const totalColumns = 3 + submissionDataKeys.length; // Completed At, Location, Workers + submission data columns

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Completed At</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Workers</TableHead>
            {submissionDataKeys.map((key) => (
              <TableHead key={key}>{formatColumnHeader(key)}</TableHead>
            ))}
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
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {new Date(job.completed_at).toLocaleString()}
                </TableCell>
                <TableCell>{job.location ? job.location.name : "-"}</TableCell>
                <TableCell>
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
                {submissionDataKeys.map((key) => (
                  <TableCell key={key}>
                    {formatValue(job.submission_data?.[key] ?? null)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
