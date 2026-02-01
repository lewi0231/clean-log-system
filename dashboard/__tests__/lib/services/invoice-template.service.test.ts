import { InvoiceTemplateService } from "@/lib/services/invoice-template.service";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
    },
}));
vi.mock("@/lib/logger", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe("InvoiceTemplateService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getConfig", () => {
        it("should get invoice template config successfully", async () => {
            const mockConfig = {
                invoice_title: "Invoice",
                show_logo: true,
                show_abn: true,
                bill_to_fields: ["name", "email"],
                service_address_config: {
                    source: "location",
                    location_fields: ["address"],
                },
                billing_address_config: {
                    source: "location",
                    location_fields: ["address"],
                },
                email_recipient_config: {
                    location_email_source: "location_email",
                    form_field_email: null,
                    default_email: null,
                },
                line_item_display: {
                    show_quantity: true,
                    show_unit_price: true,
                    show_total: true,
                },
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    config: mockConfig,
                },
                error: null,
            });

            const result = await InvoiceTemplateService.getConfig("org-1");

            expect(result).toEqual(mockConfig);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "get-invoice-template-config",
                {
                    body: {
                        organization_id: "org-1",
                    },
                },
            );
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                InvoiceTemplateService.getConfig("org-1"),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when config is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await expect(
                InvoiceTemplateService.getConfig("org-1"),
            ).rejects.toThrow("Failed to get invoice template config");
        });
    });

    describe("updateConfig", () => {
        it("should update invoice template config successfully", async () => {
            const mockConfig = {
                invoice_title: "Updated Invoice",
                show_logo: false,
                show_abn: true,
                bill_to_fields: ["name"],
                service_address_config: {
                    source: "location",
                    location_fields: ["address"],
                },
                billing_address_config: {
                    source: "location",
                    location_fields: ["address"],
                },
                email_recipient_config: {
                    location_email_source: "location_email",
                    form_field_email: null,
                    default_email: "default@example.com",
                },
                line_item_display: {
                    show_quantity: true,
                    show_unit_price: true,
                    show_total: true,
                },
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    config: mockConfig,
                },
                error: null,
            });

            const result = await InvoiceTemplateService.updateConfig({
                organization_id: "org-1",
                invoice_title: "Updated Invoice",
                show_logo: false,
                email_recipient_config: {
                    location_email_source: "location_email",
                    form_field_email: null,
                    default_email: "default@example.com",
                },
            });

            expect(result).toEqual(mockConfig);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "update-invoice-template-config",
                {
                    body: {
                        organization_id: "org-1",
                        invoice_title: "Updated Invoice",
                        show_logo: false,
                        email_recipient_config: {
                            location_email_source: "location_email",
                            form_field_email: null,
                            default_email: "default@example.com",
                        },
                    },
                },
            );
        });

        it("should update partial config", async () => {
            const mockConfig = {
                invoice_title: "Invoice",
                show_logo: true,
                show_abn: true,
                bill_to_fields: [],
                service_address_config: {
                    source: "location",
                    location_fields: [],
                },
                billing_address_config: {
                    source: "location",
                    location_fields: [],
                },
                email_recipient_config: {
                    location_email_source: "location_email",
                    form_field_email: null,
                    default_email: null,
                },
                line_item_display: {
                    show_quantity: true,
                    show_unit_price: true,
                    show_total: true,
                },
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    config: mockConfig,
                },
                error: null,
            });

            const result = await InvoiceTemplateService.updateConfig({
                organization_id: "org-1",
                show_logo: false,
            });

            expect(result).toEqual(mockConfig);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "update-invoice-template-config",
                {
                    body: {
                        organization_id: "org-1",
                        show_logo: false,
                    },
                },
            );
        });

        it("should throw error when Supabase returns error", async () => {
            const mockError = { message: "Network error", status: 500 };
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: mockError,
            });

            await expect(
                InvoiceTemplateService.updateConfig({
                    organization_id: "org-1",
                    show_logo: false,
                }),
            ).rejects.toMatchObject(mockError);
        });

        it("should throw error when config is missing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await expect(
                InvoiceTemplateService.updateConfig({
                    organization_id: "org-1",
                    show_logo: false,
                }),
            ).rejects.toThrow("Failed to update invoice template config");
        });
    });
});
