"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { jobsKey } from "@/app/query-provider";
import { JobsService } from "@/lib/services";
import type { Job, JobEdit } from "@/lib/types";
import type {
  CreateJobRequest,
  GetJobEditsRequest,
  UpdateJobRequest,
} from "@/lib/types/api";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseJobsResult {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createJob: (request: CreateJobRequest) => Promise<Job>;
  updateJob: (request: UpdateJobRequest) => Promise<Job>;
  getJobEdits: (request: GetJobEditsRequest) => Promise<JobEdit[]>;
  sendFeedbackEmail: (jobId: string) => Promise<void>;
}

async function fetchJobs(
  organizationId: string,
  includeTests?: boolean,
): Promise<Job[]> {
  const response = await JobsService.list({
    organization_id: organizationId,
    include_tests: includeTests,
  });
  return response.jobs || [];
}

export function useJobs(options?: { includeTests?: boolean }): UseJobsResult {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const includeTests = options?.includeTests ?? false;

  const query = useQuery({
    queryKey: jobsKey(organizationId, includeTests),
    enabled: !!organizationId,
    queryFn: () => fetchJobs(organizationId as string, includeTests),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  const createJob = useCallback(
    async (request: CreateJobRequest): Promise<Job> => {
      const response = await JobsService.create(request);

      // Invalidate and refetch jobs
      await queryClient.invalidateQueries({
        queryKey: jobsKey(organizationId, includeTests),
      });
      await query.refetch();

      // Return the created job (we'll need to fetch it from the list)
      // For now, return a partial job object
      return {
        id: response.job.id,
        organization_id: response.job.organization_id,
        location_id: response.job.location_id,
        submission_data: null, // Will be populated on refetch
        completed_at: response.job.completed_at,
        created_at: response.job.created_at,
        location: null,
        workers: [],
      };
    },
    [queryClient, organizationId, query, includeTests],
  );

  const updateJob = useCallback(
    async (request: UpdateJobRequest): Promise<Job> => {
      const response = await JobsService.update(request);

      // Invalidate and refetch jobs
      await queryClient.invalidateQueries({
        queryKey: jobsKey(organizationId, includeTests),
      });
      await query.refetch();

      return response.job;
    },
    [queryClient, organizationId, query, includeTests],
  );

  const getJobEdits = useCallback(
    async (request: GetJobEditsRequest): Promise<JobEdit[]> => {
      const response = await JobsService.getEdits(request);
      return response.edits || [];
    },
    [],
  );

  const sendFeedbackEmail = useCallback(
    async (jobId: string): Promise<void> => {
      await JobsService.sendFeedbackEmail(jobId);

      // Invalidate and refetch jobs to get updated feedback status
      await queryClient.invalidateQueries({
        queryKey: jobsKey(organizationId, includeTests),
      });
      await query.refetch();
    },
    [queryClient, organizationId, query, includeTests],
  );

  return {
    jobs: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    createJob,
    updateJob,
    getJobEdits,
    sendFeedbackEmail,
  };
}
