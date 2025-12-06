"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invoicesKey } from "@/app/query-provider";
import type { CalculateInvoiceResponse } from "@/lib/services/invoice.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import type { CreateInvoiceRequest, InvoiceWithJobs } from "@/lib/types";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseInvoicesResult {
  invoices: InvoiceWithJobs[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  calculateInvoice: (
    jobIds: string[],
  ) => Promise<CalculateInvoiceResponse["calculation"]>;
  createInvoice: (request: CreateInvoiceRequest) => Promise<InvoiceWithJobs>;
}

async function fetchInvoices(
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<InvoiceWithJobs[]> {
  return InvoiceService.list({
    organization_id: organizationId,
    start_date: startDate,
    end_date: endDate,
  });
}

export function useInvoices(
  startDate?: string,
  endDate?: string,
): UseInvoicesResult {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: invoicesKey(organizationId, startDate, endDate),
    enabled: !!organizationId,
    queryFn: () => fetchInvoices(organizationId as string, startDate, endDate),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: InvoiceService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: invoicesKey(organizationId, startDate, endDate),
      });
    },
  });

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
    [organizationId],
  );

  const createInvoice = useCallback(
    async (request: CreateInvoiceRequest): Promise<InvoiceWithJobs> => {
      const invoice = await createMutation.mutateAsync(request);
      await query.refetch();
      return invoice;
    },
    [createMutation, query],
  );

  return {
    invoices: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    calculateInvoice,
    createInvoice,
  };
}
