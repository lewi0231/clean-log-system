"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Job } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface FlaggedJobsAlertProps {
  jobs: Job[];
  onResolve: (jobId: string, action: "approve" | "cancel", notes?: string) => Promise<void>;
  isResolving?: boolean;
}

interface FlagDetails {
  workerName: string;
  flagReason: string;
  flaggedAt: string;
}

function getFlagDetails(job: Job): FlagDetails | null {
  const flaggedWorker = job.workers.find(
    (w) => w.confirmation_status === "flagged"
  );
  if (!flaggedWorker) return null;

  return {
    workerName: flaggedWorker.name,
    flagReason: flaggedWorker.flag_reason || "No reason provided",
    flaggedAt: flaggedWorker.flagged_at || "",
  };
}

export default function FlaggedJobsAlert({
  jobs,
  onResolve,
  isResolving = false,
}: FlaggedJobsAlertProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resolveAction, setResolveAction] = useState<"approve" | "cancel" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const flaggedJobs = jobs.filter((job) => job.approval_status === "flagged");

  if (flaggedJobs.length === 0) {
    return null;
  }

  const handleResolveClick = (job: Job, action: "approve" | "cancel") => {
    setSelectedJob(job);
    setResolveAction(action);
    setAdminNotes("");
  };

  const handleConfirmResolve = async () => {
    if (!selectedJob || !resolveAction) return;

    await onResolve(selectedJob.id, resolveAction, adminNotes || undefined);
    setSelectedJob(null);
    setResolveAction(null);
    setAdminNotes("");
  };

  const handleCancel = () => {
    setSelectedJob(null);
    setResolveAction(null);
    setAdminNotes("");
  };

  return (
    <>
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Attention Required</AlertTitle>
        <AlertDescription>
          {flaggedJobs.length === 1
            ? "1 job has been flagged by a worker and requires your review."
            : `${flaggedJobs.length} jobs have been flagged by workers and require your review.`}
        </AlertDescription>
      </Alert>

      <div className="space-y-4 mb-8">
        {flaggedJobs.map((job) => {
          const flagDetails = getFlagDetails(job);
          return (
            <Card key={job.id} className="border-destructive/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      {job.location?.name || "Unknown Location"}
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(job.completed_at), "PPP 'at' p")}
                    </CardDescription>
                  </div>
                  <Badge variant="destructive">Flagged</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {flagDetails && (
                  <div className="bg-muted p-3 rounded-md space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Flagged by:</span>
                      <span className="font-medium">{flagDetails.workerName}</span>
                      {flagDetails.flaggedAt && (
                        <span className="text-muted-foreground text-xs">
                          ({format(new Date(flagDetails.flaggedAt), "PP")})
                        </span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason:</span>
                      <p className="mt-1 text-foreground">
                        &ldquo;{flagDetails.flagReason}&rdquo;
                      </p>
                    </div>
                  </div>
                )}

                {/* Workers on the job */}
                <div className="text-sm">
                  <span className="text-muted-foreground">Workers:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {job.workers.map((worker) => (
                      <Badge
                        key={worker.id}
                        variant={
                          worker.confirmation_status === "flagged"
                            ? "destructive"
                            : worker.confirmation_status === "confirmed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {worker.name}
                        {worker.confirmation_status === "flagged" && " (flagged)"}
                        {worker.confirmation_status === "pending" && " (pending)"}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolveClick(job, "approve")}
                    disabled={isResolving}
                    className="text-green-600 hover:text-green-700 hover:border-green-600"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve Job
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolveClick(job, "cancel")}
                    disabled={isResolving}
                    className="text-destructive hover:text-destructive hover:border-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedJob && !!resolveAction} onOpenChange={() => handleCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === "approve" ? "Approve Job" : "Cancel Job"}
            </DialogTitle>
            <DialogDescription>
              {resolveAction === "approve"
                ? "This will approve the job despite the flag. The job will be finalized and included in payment calculations."
                : "This will cancel the job. It will not be included in payment calculations or invoices."}
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Job:</span>
                <p className="font-medium">
                  {selectedJob.location?.name || "Unknown Location"}
                </p>
                <p className="text-muted-foreground">
                  {format(new Date(selectedJob.completed_at), "PPP 'at' p")}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Admin Notes (optional)
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about this resolution..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isResolving}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmResolve}
              disabled={isResolving}
              variant={resolveAction === "cancel" ? "destructive" : "default"}
            >
              {isResolving
                ? "Processing..."
                : resolveAction === "approve"
                ? "Approve Job"
                : "Cancel Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
