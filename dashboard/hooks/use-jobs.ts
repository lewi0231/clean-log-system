"use client";

import { useQuery } from "@tanstack/react-query";

import { jobsKey } from "@/app/query-provider";
import { JobsService } from "@/lib/services";
import type { Job } from "@/lib/types";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseJobsResult {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

async function fetchJobs(organizationId: string): Promise<Job[]> {
  const response = await JobsService.list({
    organization_id: organizationId,
  });
  return response.jobs || [];
}

export function useJobs(): UseJobsResult {
  const { organizationId } = useOrganization();

  const query = useQuery({
    queryKey: jobsKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchJobs(organizationId as string),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  return {
    jobs: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
  };
}
