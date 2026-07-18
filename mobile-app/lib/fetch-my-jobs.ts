import { supabase } from "@/lib/supabase";

export type MyJobListItem = {
  id: string;
  created_at: string;
  completed_at?: string;
  approval_status?: string;
  submitted_by_worker_id?: string | null;
  submission_data?: Record<string, unknown> | null;
  location?: { name?: string; address?: string };
  workers?: Array<{
    id: string;
    name: string;
    confirmation_status?: string;
  }>;
  [key: string]: unknown;
};

type FetchMyJobsResult = { ok: true; jobs: MyJobListItem[] } | { ok: false; message: string };

export async function fetchMyJobs(
  organizationId: string,
  accessToken: string
): Promise<FetchMyJobsResult> {
  const { data, error } = await supabase.functions.invoke("list-jobs", {
    body: {
      organization_id: organizationId,
      mine: true,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    return { ok: false, message: "Failed to load jobs. Please try again." };
  }

  if (data?.error) {
    return { ok: false, message: "Failed to load jobs. Please try again." };
  }

  const jobs = (data?.jobs ?? []) as MyJobListItem[];
  const sortedJobs = [...jobs].sort(
    (a, b) =>
      new Date(b.completed_at || b.created_at || 0).getTime() -
      new Date(a.completed_at || a.created_at || 0).getTime()
  );

  return { ok: true, jobs: sortedJobs };
}

export function getSubmitterNameForJob(
  job: Pick<MyJobListItem, "submitted_by_worker_id" | "workers">,
  currentWorkerId?: string | null
): string | null {
  if (!job.submitted_by_worker_id || !currentWorkerId) return null;
  if (job.submitted_by_worker_id === currentWorkerId) return null;

  const submitter = job.workers?.find((worker) => worker.id === job.submitted_by_worker_id);
  return submitter?.name ?? "Unknown";
}
