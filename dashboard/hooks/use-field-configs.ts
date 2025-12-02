"use client";

import { FieldConfigsService } from "@/lib/services";
import type { FieldConfig } from "@clean-log/shared/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseFieldConfigsResult {
  fieldConfigs: FieldConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFieldConfigs(): UseFieldConfigsResult {
  const { organizationId } = useOrganization();
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFieldConfigs = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const configs = await FieldConfigsService.list({
        organization_id: organizationId,
      });

      setFieldConfigs(configs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch field configs"
      );
      setFieldConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFieldConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    fieldConfigs,
    loading,
    error,
    refetch: fetchFieldConfigs,
  };
}
