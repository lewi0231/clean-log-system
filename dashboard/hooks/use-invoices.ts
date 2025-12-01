"use client";

import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import type { CreateInvoiceRequest, InvoiceWithJobs } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseInvoicesResult {
  invoices: InvoiceWithJobs[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  calculateInvoice: (
    jobIds: string[]
  ) => Promise<CalculateInvoiceResponse["calculation"]>;
  createInvoice: (request: CreateInvoiceRequest) => Promise<InvoiceWithJobs>;
}

export function useInvoices(
  startDate?: string,
  endDate?: string
): UseInvoicesResult {
  const { organizationId } = useOrganization();
  const [invoices, setInvoices] = useState<InvoiceWithJobs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await InvoiceService.list({
        organization_id: organizationId,
        start_date: startDate,
        end_date: endDate,
      });

      setInvoices(response || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch invoices");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, startDate, endDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const calculateInvoice = useCallback(
    async (jobIds: string[]) => {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      return await InvoiceService.calculate({
        organization_id: organizationId,
        job_ids: jobIds,
      });
    },
    [organizationId]
  );

  const createInvoice = useCallback(
    async (request: CreateInvoiceRequest) => {
      const invoice = await InvoiceService.create(request);
      // Refresh the list after creating
      await fetchInvoices();
      return invoice;
    },
    [fetchInvoices]
  );

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
    calculateInvoice,
    createInvoice,
  };
}
