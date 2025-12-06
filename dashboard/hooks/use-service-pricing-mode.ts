"use client";

import { ServicePricingModeService } from "@/lib/services";
import type { ServicePricingMode } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseServicePricingModeOptions {
    locationId?: string | null;
    fieldConfigId?: string;
}

interface UseServicePricingModeResult {
    servicePricingModes: ServicePricingMode[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    upsertPricingMode: (
        fieldConfigId: string,
        optionValue: string,
        pricingMode: "field_based" | "fixed_price",
        options?: {
            fixedCustomerPrice?: number | null;
            fixedWorkerPayment?: number | null;
            fixedPriceCurrency?: string;
            locationId?: string | null;
        },
    ) => Promise<ServicePricingMode>;
    deletePricingMode: (id: string) => Promise<void>;
}

function servicePricingModeKey(
    organizationId: string | null,
    locationId?: string | null,
    fieldConfigId?: string,
) {
    return [
        "service-pricing-modes",
        organizationId,
        locationId,
        fieldConfigId,
    ] as const;
}

async function fetchServicePricingModes(
    organizationId: string,
    options?: UseServicePricingModeOptions,
): Promise<ServicePricingMode[]> {
    return ServicePricingModeService.list({
        organization_id: organizationId,
        location_id: options?.locationId,
        service_type_field_config_id: options?.fieldConfigId,
    });
}

export function useServicePricingMode(
    options?: UseServicePricingModeOptions,
): UseServicePricingModeResult {
    const { organizationId } = useOrganization();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: servicePricingModeKey(
            organizationId,
            options?.locationId,
            options?.fieldConfigId,
        ),
        enabled: !!organizationId,
        queryFn: () =>
            fetchServicePricingModes(organizationId as string, options),
        select: (data) => data ?? [],
        placeholderData: (previous) => previous,
    });

    const upsertMutation = useMutation({
        mutationFn: async ({
            fieldConfigId,
            optionValue,
            pricingMode,
            fixedCustomerPrice,
            fixedWorkerPayment,
            fixedPriceCurrency,
            locationId,
        }: {
            fieldConfigId: string;
            optionValue: string;
            pricingMode: "field_based" | "fixed_price";
            fixedCustomerPrice?: number | null;
            fixedWorkerPayment?: number | null;
            fixedPriceCurrency?: string;
            locationId?: string | null;
        }) => {
            if (!organizationId) {
                throw new Error("Organization ID is required");
            }

            return ServicePricingModeService.upsert({
                organization_id: organizationId,
                service_type_field_config_id: fieldConfigId,
                service_type_value: optionValue,
                pricing_mode: pricingMode,
                fixed_customer_price: fixedCustomerPrice,
                fixed_worker_payment: fixedWorkerPayment,
                fixed_price_currency: fixedPriceCurrency,
                location_id: locationId ?? options?.locationId ?? null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: servicePricingModeKey(
                    organizationId,
                    options?.locationId,
                    options?.fieldConfigId,
                ),
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: ServicePricingModeService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: servicePricingModeKey(
                    organizationId,
                    options?.locationId,
                    options?.fieldConfigId,
                ),
            });
        },
    });

    const upsertPricingMode = useCallback(
        async (
            fieldConfigId: string,
            optionValue: string,
            pricingMode: "field_based" | "fixed_price",
            upsertOptions?: {
                fixedCustomerPrice?: number | null;
                fixedWorkerPayment?: number | null;
                fixedPriceCurrency?: string;
                locationId?: string | null;
            },
        ): Promise<ServicePricingMode> => {
            return upsertMutation.mutateAsync({
                fieldConfigId,
                optionValue,
                pricingMode,
                fixedCustomerPrice: upsertOptions?.fixedCustomerPrice,
                fixedWorkerPayment: upsertOptions?.fixedWorkerPayment,
                fixedPriceCurrency: upsertOptions?.fixedPriceCurrency,
                locationId: upsertOptions?.locationId,
            });
        },
        [upsertMutation],
    );

    const deletePricingMode = useCallback(
        async (id: string): Promise<void> => {
            await deleteMutation.mutateAsync(id);
        },
        [deleteMutation],
    );

    return {
        servicePricingModes: query.data ?? [],
        loading: query.isLoading,
        error: query.error ? (query.error as Error).message : null,
        refetch: useCallback(
            () => query.refetch().then(() => undefined),
            [query],
        ),
        upsertPricingMode,
        deletePricingMode,
    };
}
