"use client";

import { JobsService } from "@/lib/services";
import type { Job } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseJobsResult {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useJobs(): UseJobsResult {
  const { organizationId } = useOrganization();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await JobsService.list({
        organization_id: organizationId,
      });

      setJobs(response.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs,
  };
}
