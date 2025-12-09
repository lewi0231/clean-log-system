/**
 * P1 High Priority Tests: Invoice Template Config Validation
 *
 * These tests ensure invoice template configurations are validated correctly.
 * Missing defaults or invalid configs could cause runtime errors or incorrect invoice rendering.
 */

import {
    BILLING_ADDRESS_SOURCE,
    EMAIL_RECIPIENT_SOURCE,
    INVOICE_TITLE_OPTIONS,
    SERVICE_ADDRESS_SOURCE,
} from "@/lib/constants/invoice-constants";
import {
    billingAddressConfigSchema,
    emailRecipientConfigSchema,
    invoiceTemplateConfigSchema,
    lineItemDisplayConfigSchema,
    serviceAddressConfigSchema,
    validateInvoiceTemplateConfig,
} from "@/lib/validations/invoice-template";
import { describe, expect, it } from "vitest";

describe("Invoice Template Config Validation - P1 Tests", () => {
    describe("Service Address Config Schema", () => {
        it("P1: should validate valid service address config with location fields", () => {
            const validConfig = {
                source: SERVICE_ADDRESS_SOURCE.LOCATION,
                location_fields: ["name", "address", "email"],
                form_fields: ["address"],
            };

            const result = serviceAddressConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should validate valid service address config with form fields", () => {
            const validConfig = {
                source: SERVICE_ADDRESS_SOURCE.FORM_FIELDS,
                form_fields: ["field1", "field2"],
            };

            const result = serviceAddressConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should reject invalid source", () => {
            const invalidConfig = {
                source: "invalid_source",
                location_fields: ["name"],
            };

            const result = serviceAddressConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });

        it("P1: should require location_fields when source is location", () => {
            const invalidConfig = {
                source: SERVICE_ADDRESS_SOURCE.LOCATION,
                // Missing location_fields
            };

            const result = serviceAddressConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(
                    result.error.issues.some((issue) =>
                        issue.path.includes("location_fields")
                    ),
                ).toBe(true);
            }
        });

        it("P1: should reject invalid location field names", () => {
            const invalidConfig = {
                source: SERVICE_ADDRESS_SOURCE.LOCATION,
                location_fields: ["invalid_field", "name"],
            };

            const result = serviceAddressConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });

    describe("Billing Address Config Schema", () => {
        it("P1: should validate valid billing address config", () => {
            const validConfig = {
                enabled: true,
                source: BILLING_ADDRESS_SOURCE.ORGANIZATION,
            };

            const result = billingAddressConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should reject invalid source", () => {
            const invalidConfig = {
                enabled: true,
                source: "invalid_source",
            };

            const result = billingAddressConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });

        it("P1: should require enabled to be boolean", () => {
            const invalidConfig = {
                enabled: "true", // String instead of boolean
                source: BILLING_ADDRESS_SOURCE.AUTO,
            };

            const result = billingAddressConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });

    describe("Email Recipient Config Schema", () => {
        it("P1: should validate valid email recipient config", () => {
            const validConfig = {
                location_email_source: EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                form_field_email: null,
                default_email: "default@example.com",
            };

            const result = emailRecipientConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should reject invalid email format in default_email", () => {
            const invalidConfig = {
                location_email_source: EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                form_field_email: null,
                default_email: "invalid-email",
            };

            const result = emailRecipientConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });

        it("P1: should accept null default_email", () => {
            const validConfig = {
                location_email_source: EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                form_field_email: null,
                default_email: null,
            };

            const result = emailRecipientConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should reject invalid location_email_source", () => {
            const invalidConfig = {
                location_email_source: "invalid_source",
                form_field_email: null,
                default_email: null,
            };

            const result = emailRecipientConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });

    describe("Line Item Display Config Schema", () => {
        it("P1: should validate valid line item display config", () => {
            const validConfig = {
                include_option_value: true,
                description_format: "{field_label}: {option_value}",
                show_base_price_separately: true,
            };

            const result = lineItemDisplayConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should require description_format to be non-empty", () => {
            const invalidConfig = {
                include_option_value: true,
                description_format: "",
                show_base_price_separately: true,
            };

            const result = lineItemDisplayConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });

    describe("Complete Invoice Template Config Schema", () => {
        it("P1: should validate complete valid config", () => {
            const validConfig = {
                invoice_title: INVOICE_TITLE_OPTIONS.TAX_INVOICE,
                show_logo: true,
                show_abn: true,
                service_address_config: {
                    source: SERVICE_ADDRESS_SOURCE.AUTO,
                    location_fields: ["name", "address"],
                    form_fields: ["address"],
                },
                billing_address_config: {
                    enabled: false,
                    source: BILLING_ADDRESS_SOURCE.AUTO,
                },
                email_recipient_config: {
                    location_email_source:
                        EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                    form_field_email: null,
                    default_email: null,
                },
                line_item_display: {
                    include_option_value: true,
                    description_format: "{field_label}: {option_value}",
                    show_base_price_separately: true,
                },
            };

            const result = invoiceTemplateConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });

        it("P1: should require description_format placeholders when include_option_value is true", () => {
            const invalidConfig = {
                invoice_title: INVOICE_TITLE_OPTIONS.TAX_INVOICE,
                show_logo: true,
                show_abn: true,
                service_address_config: {
                    source: SERVICE_ADDRESS_SOURCE.AUTO,
                    location_fields: ["name"],
                    form_fields: ["address"],
                },
                billing_address_config: {
                    enabled: false,
                    source: BILLING_ADDRESS_SOURCE.AUTO,
                },
                email_recipient_config: {
                    location_email_source:
                        EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                    form_field_email: null,
                    default_email: null,
                },
                line_item_display: {
                    include_option_value: true,
                    description_format: "Missing placeholders", // Missing {field_label} and {option_value}
                    show_base_price_separately: true,
                },
            };

            const result = invoiceTemplateConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
            if (!result.success) {
                const error = result.error.issues.find((issue) =>
                    issue.path.includes("description_format")
                );
                expect(error).toBeDefined();
                expect(error?.message).toContain("field_label");
                expect(error?.message).toContain("option_value");
            }
        });

        it("P1: should allow description_format without placeholders when include_option_value is false", () => {
            const validConfig = {
                invoice_title: INVOICE_TITLE_OPTIONS.TAX_INVOICE,
                show_logo: true,
                show_abn: true,
                service_address_config: {
                    source: SERVICE_ADDRESS_SOURCE.AUTO,
                    location_fields: ["name"],
                    form_fields: ["address"],
                },
                billing_address_config: {
                    enabled: false,
                    source: BILLING_ADDRESS_SOURCE.AUTO,
                },
                email_recipient_config: {
                    location_email_source:
                        EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                    form_field_email: null,
                    default_email: null,
                },
                line_item_display: {
                    include_option_value: false,
                    description_format: "Simple description", // No placeholders needed
                    show_base_price_separately: true,
                },
            };

            const result = invoiceTemplateConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });
    });

    describe("validateInvoiceTemplateConfig function", () => {
        it("P1: should return success with data for valid config", () => {
            const validConfig = {
                invoice_title: INVOICE_TITLE_OPTIONS.TAX_INVOICE,
                show_logo: true,
                show_abn: true,
                service_address_config: {
                    source: SERVICE_ADDRESS_SOURCE.AUTO,
                    location_fields: ["name", "address"],
                    form_fields: ["address"],
                },
                billing_address_config: {
                    enabled: false,
                    source: BILLING_ADDRESS_SOURCE.AUTO,
                },
                email_recipient_config: {
                    location_email_source:
                        EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                    form_field_email: null,
                    default_email: null,
                },
                line_item_display: {
                    include_option_value: true,
                    description_format: "{field_label}: {option_value}",
                    show_base_price_separately: true,
                },
            };

            const result = validateInvoiceTemplateConfig(validConfig);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.errors).toBeUndefined();
        });

        it("P1: should return errors for invalid config", () => {
            const invalidConfig = {
                invoice_title: "Invalid Title",
                show_logo: "not a boolean",
                // Missing required fields
            };

            const result = validateInvoiceTemplateConfig(invalidConfig);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(Object.keys(result.errors || {}).length).toBeGreaterThan(0);
        });

        it("P1: should format error paths correctly", () => {
            const invalidConfig = {
                invoice_title: INVOICE_TITLE_OPTIONS.TAX_INVOICE,
                show_logo: true,
                show_abn: true,
                service_address_config: {
                    source: "invalid_source",
                },
                billing_address_config: {
                    enabled: false,
                    source: BILLING_ADDRESS_SOURCE.AUTO,
                },
                email_recipient_config: {
                    location_email_source:
                        EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
                    form_field_email: null,
                    default_email: "invalid-email",
                },
                line_item_display: {
                    include_option_value: true,
                    description_format: "{field_label}: {option_value}",
                    show_base_price_separately: true,
                },
            };

            const result = validateInvoiceTemplateConfig(invalidConfig);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();

            // Check that error paths are formatted correctly
            const errorKeys = Object.keys(result.errors || {});
            expect(
                errorKeys.some((key) => key.includes("service_address_config")),
            ).toBe(true);
            expect(
                errorKeys.some((key) => key.includes("email_recipient_config")),
            ).toBe(true);
        });
    });
});
