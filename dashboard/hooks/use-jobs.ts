"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { jobsKey } from "@/app/query-provider";
import { JobsService } from "@/lib/services";
import type { Job } from "@/lib/types";
import type { CreateJobRequest } from "@/lib/types/api";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseJobsResult {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createJob: (request: CreateJobRequest) => Promise<Job>;
}

async function fetchJobs(organizationId: string): Promise<Job[]> {
  const response = await JobsService.list({
    organization_id: organizationId,
  });
  return response.jobs || [];
}

export function useJobs(): UseJobsResult {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: jobsKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchJobs(organizationId as string),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  const createJob = useCallback(
    async (request: CreateJobRequest): Promise<Job> => {
      const response = await JobsService.create(request);

      // Invalidate and refetch jobs
      await queryClient.invalidateQueries({
        queryKey: jobsKey(organizationId),
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
    [queryClient, organizationId, query],
  );

  return {
    jobs: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    createJob,
  };
}
