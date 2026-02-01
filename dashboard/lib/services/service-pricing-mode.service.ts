import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import type { ServicePricingMode } from "@/lib/types";

export interface ListServicePricingModesRequest {
    organization_id: string;
    location_id?: string | null;
    service_type_field_config_id?: string;
    service_type_value?: string;
}

export interface UpsertServicePricingModeRequest {
    organization_id: string;
    service_type_field_config_id: string;
    service_type_value: string;
    pricing_mode: "field_based" | "fixed_price";
    fixed_customer_price?: number | null;
    fixed_worker_payment?: number | null;
    fixed_price_currency?: string;
    location_id?: string | null;
}

export class ServicePricingModeService {
    static async list(
        request: ListServicePricingModesRequest,
    ): Promise<ServicePricingMode[]> {
        try {
            log.debug(
                "ServicePricingModeService: listing service pricing modes",
                {
                    organizationId: request.organization_id,
                    locationId: request.location_id,
                },
            );

            const data = await invokeEdgeFunction<{
                success?: boolean;
                error?: string;
                service_pricing_modes?: ServicePricingMode[];
            }>("list-service-pricing-modes", request as unknown as Record<string, unknown>);

            if (!data?.success) {
                throw new Error(
                    data?.error || "Failed to list service pricing modes",
                );
            }

            return (data.service_pricing_modes || []) as ServicePricingMode[];
        } catch (err) {
            log.error(
                "ServicePricingModeService: Failed to list service pricing modes",
                {
                    error: err instanceof Error ? err.message : "Unknown error",
                },
            );
            throw err;
        }
    }

    static async upsert(
        request: UpsertServicePricingModeRequest,
    ): Promise<ServicePricingMode> {
        try {
            log.debug(
                "ServicePricingModeService: upserting service pricing mode",
                {
                    organizationId: request.organization_id,
                    serviceTypeFieldConfigId:
                        request.service_type_field_config_id,
                    serviceTypeValue: request.service_type_value,
                },
            );

            const data = await invokeEdgeFunction<{
                success?: boolean;
                error?: string;
                service_pricing_mode?: ServicePricingMode;
            }>("upsert-service-pricing-mode", request as unknown as Record<string, unknown>);

            if (!data?.success) {
                throw new Error(
                    data?.error || "Failed to upsert service pricing mode",
                );
            }

            return data.service_pricing_mode as ServicePricingMode;
        } catch (err) {
            log.error(
                "ServicePricingModeService: Failed to upsert service pricing mode",
                {
                    error: err instanceof Error ? err.message : "Unknown error",
                },
            );
            throw err;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            log.debug(
                "ServicePricingModeService: deleting service pricing mode",
                {
                    id,
                },
            );

            const data = await invokeEdgeFunction<{ success?: boolean; error?: string }>(
                "delete-service-pricing-mode",
                { id },
            );

            if (!data?.success) {
                throw new Error(
                    data?.error || "Failed to delete service pricing mode",
                );
            }
        } catch (err) {
            log.error(
                "ServicePricingModeService: Failed to delete service pricing mode",
                {
                    error: err instanceof Error ? err.message : "Unknown error",
                },
            );
            throw err;
        }
    }
}
