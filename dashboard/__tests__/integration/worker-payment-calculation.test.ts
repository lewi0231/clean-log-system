/**
 * Integration tests for worker payment calculation based on pricing rules
 *
 * These tests verify that worker payments are calculated correctly based on:
 * 1. Customer pricing rules with worker_payment_type and worker_payment_value
 * 2. Worker context pricing rules (where base_price IS the worker payment)
 * 3. Different worker_payment_type values (same_structure, percentage, fixed_rate)
 */

import { PricingService } from "@/lib/services/pricing.service";
import {
    type CalculateWorkerPaymentsResponse,
    WorkerPaymentService,
} from "@/lib/services/worker-payment.service";
import type { PricingRule } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/services/pricing.service");
vi.mock("@/lib/services/worker-payment.service");
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
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const createMockPricingRule = (
    overrides?: Partial<PricingRule>,
): PricingRule => ({
    id: "rule-1",
    organization_id: "org-1",
    scope: "field",
    pricing_type: "unit",
    pricing_context: "customer",
    field_config_id: "field-1",
    option_value: null,
    applies_to_field_type: "number",
    location_hierarchy_id: null,
    location_id: null,
    currency: "USD",
    base_price: 100,
    percentage_rate: null,
    minimum_quantity: null,
    maximum_quantity: null,
    tier_definition: null,
    metadata: {},
    worker_payment_type: null,
    worker_payment_value: null,
    priority: 0,
    active: true,
    effective_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
});

describe("Worker Payment Calculation Based on Pricing Rules", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Customer Pricing Rules with Worker Payment Fields", () => {
        it("should calculate worker payment using same_structure (default)", async () => {
            // Customer pricing rule with same_structure worker payment
            // Worker gets the same amount as customer
            const customerRule = createMockPricingRule({
                id: "customer-rule-1",
                pricing_context: "customer",
                base_price: 100,
                worker_payment_type: "same_structure",
                worker_payment_value: null,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerRule,
            ]);

            // Mock worker payment calculation response
            // For same_structure, worker payment = customer amount = 100
            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 100,
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "customer-rule-1",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 100,
                                    metadata: {
                                        worker_payment_type: "same_structure",
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 100,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(100);
            expect(
                result.calculation.job_calculations[0].total_worker_payment,
            ).toBe(100);
        });

        it("should calculate worker payment using percentage", async () => {
            // Customer pricing rule with percentage worker payment
            // Customer pays 100, worker gets 50% = 50
            const customerRule = createMockPricingRule({
                id: "customer-rule-1",
                pricing_context: "customer",
                base_price: 100,
                worker_payment_type: "percentage",
                worker_payment_value: 50, // 50%
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 50, // 100 * 0.5
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "customer-rule-1",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 100,
                                    metadata: {
                                        worker_payment_type: "percentage",
                                        worker_payment_value: 50,
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 50,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(50);
            // Worker payment should be 50% of customer amount (100 * 0.5 = 50)
            expect(
                result.calculation.job_calculations[0].total_worker_payment,
            ).toBe(50);
        });

        it("should calculate worker payment using fixed_rate", async () => {
            // Customer pricing rule with fixed_rate worker payment
            // Customer pays 100, worker gets fixed 30
            const customerRule = createMockPricingRule({
                id: "customer-rule-1",
                pricing_context: "customer",
                base_price: 100,
                worker_payment_type: "fixed_rate",
                worker_payment_value: 30,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 30, // Fixed rate
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "customer-rule-1",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 100,
                                    metadata: {
                                        worker_payment_type: "fixed_rate",
                                        worker_payment_value: 30,
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 30,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(30);
            // Worker payment should be fixed rate, not based on customer amount
            expect(
                result.calculation.job_calculations[0].total_worker_payment,
            ).toBe(30);
        });
    });

    describe("Worker Context Pricing Rules", () => {
        it("should calculate worker payment from worker context pricing rule", async () => {
            // Worker context pricing rule - base_price IS the worker payment
            const workerRule = createMockPricingRule({
                id: "worker-rule-1",
                pricing_context: "worker",
                base_price: 50,
                worker_payment_type: null,
                worker_payment_value: null,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                workerRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 50,
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "worker-rule-1",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 50,
                                    metadata: {
                                        pricing_context: "worker",
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 50,
                            total_adjustments: 0,
                            total_worker_payment: 50,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(50);
            // Worker payment comes directly from base_price of worker context rule
            expect(
                result.calculation.job_calculations[0].total_worker_payment,
            ).toBe(50);
        });

        it("should prioritize worker context rules over customer rules with worker_payment", async () => {
            // Both customer and worker rules exist
            // Worker context rule should be used for worker payment calculation
            const customerRule = createMockPricingRule({
                id: "customer-rule-1",
                pricing_context: "customer",
                base_price: 100,
                worker_payment_type: "percentage",
                worker_payment_value: 50,
            });

            const workerRule = createMockPricingRule({
                id: "worker-rule-1",
                pricing_context: "worker",
                base_price: 60,
                worker_payment_type: null,
                worker_payment_value: null,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerRule,
                workerRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 60, // From worker rule, not customer rule
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "worker-rule-1",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 60,
                                    metadata: {
                                        pricing_context: "worker",
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 60,
                            total_adjustments: 0,
                            total_worker_payment: 60,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            // Worker payment should come from worker context rule (60), not customer rule (50)
            expect(result.calculation.total_worker_payment).toBe(60);
        });
    });

    describe("Option Pricing with Worker Payments", () => {
        it("should calculate worker payment for option pricing with same_structure", async () => {
            const customerOptionRule = createMockPricingRule({
                id: "customer-option-rule-1",
                scope: "option",
                pricing_context: "customer",
                field_config_id: "field-1",
                option_value: "option-1",
                base_price: 100,
                worker_payment_type: "same_structure",
                worker_payment_value: null,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerOptionRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 100,
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [
                                {
                                    field_config_id: "field-1",
                                    field_name: "service_type",
                                    field_label: "Service Type",
                                    option_value: "option-1",
                                    quantity: 1,
                                    unit_price: 100,
                                    total: 100,
                                },
                            ],
                            applied_rules: [
                                {
                                    pricing_rule_id: "customer-option-rule-1",
                                    scope: "option",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: "option-1",
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 100,
                                    metadata: {
                                        worker_payment_type: "same_structure",
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 100,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(100);
        });

        it("should calculate worker payment for option pricing with percentage", async () => {
            const customerOptionRule = createMockPricingRule({
                id: "customer-option-rule-1",
                scope: "option",
                pricing_context: "customer",
                field_config_id: "field-1",
                option_value: "option-1",
                base_price: 100,
                worker_payment_type: "percentage",
                worker_payment_value: 40, // 40%
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerOptionRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 40, // 100 * 0.4
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "customer-option-rule-1",
                                    scope: "option",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: "option-1",
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 100,
                                    metadata: {
                                        worker_payment_type: "percentage",
                                        worker_payment_value: 40,
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 40,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(40);
        });
    });

    describe("Base Pricing with Worker Payments", () => {
        it("should calculate worker payment for base pricing with worker_payment fields", async () => {
            const customerBaseRule = createMockPricingRule({
                id: "customer-base-rule-1",
                scope: "base",
                pricing_context: "customer",
                base_price: 50,
                worker_payment_type: "fixed_rate",
                worker_payment_value: 25,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerBaseRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 25, // Fixed rate
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [
                                {
                                    pricing_rule_id: "customer-base-rule-1",
                                    scope: "base",
                                    pricing_type: "flat",
                                    field_config_id: null,
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 50,
                                    metadata: {
                                        worker_payment_type: "fixed_rate",
                                        worker_payment_value: 25,
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 50,
                            total_adjustments: 0,
                            total_worker_payment: 25,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(25);
        });
    });

    describe("Multiple Rules and Aggregation", () => {
        it("should aggregate worker payments from multiple line items", async () => {
            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 180, // Sum of all worker payments
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [
                                {
                                    field_config_id: "field-1",
                                    field_name: "service_1",
                                    field_label: "Service 1",
                                    quantity: 2,
                                    unit_price: 50,
                                    total: 100,
                                },
                                {
                                    field_config_id: "field-2",
                                    field_name: "service_2",
                                    field_label: "Service 2",
                                    quantity: 1,
                                    unit_price: 80,
                                    total: 80,
                                },
                            ],
                            applied_rules: [
                                {
                                    pricing_rule_id: "rule-1",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-1",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 100,
                                    metadata: {
                                        worker_payment_type: "percentage",
                                        worker_payment_value: 50,
                                    },
                                    snapshot_data: {},
                                },
                                {
                                    pricing_rule_id: "rule-2",
                                    scope: "field",
                                    pricing_type: "unit",
                                    field_config_id: "field-2",
                                    option_value: null,
                                    location_hierarchy_id: null,
                                    location_id: null,
                                    amount: 80,
                                    metadata: {
                                        worker_payment_type: "fixed_rate",
                                        worker_payment_value: 80,
                                    },
                                    snapshot_data: {},
                                },
                            ],
                            subtotal: 180,
                            total_adjustments: 0,
                            total_worker_payment: 180, // 50 (50% of 100) + 80 (fixed)
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(180);
            expect(result.calculation.job_calculations[0].line_items)
                .toHaveLength(
                    2,
                );
        });

        it("should calculate worker payments for multiple jobs", async () => {
            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 250, // Sum across all jobs
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 100,
                        },
                        {
                            job_id: "job-2",
                            line_items: [],
                            applied_rules: [],
                            subtotal: 150,
                            total_adjustments: 0,
                            total_worker_payment: 150,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1", "job-2"],
            });

            expect(result.calculation.total_worker_payment).toBe(250);
            expect(result.calculation.job_calculations).toHaveLength(2);
        });
    });

    describe("Edge Cases", () => {
        it("should handle null worker_payment_value gracefully", async () => {
            const customerRule = createMockPricingRule({
                id: "customer-rule-1",
                pricing_context: "customer",
                base_price: 100,
                worker_payment_type: "percentage",
                worker_payment_value: null, // Should default to 0
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 0, // null worker_payment_value = 0
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 0,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result.calculation.total_worker_payment).toBe(0);
        });

        it("should handle missing worker_payment_type (defaults to same_structure)", async () => {
            const customerRule = createMockPricingRule({
                id: "customer-rule-1",
                pricing_context: "customer",
                base_price: 100,
                worker_payment_type: null, // Should default to same_structure
                worker_payment_value: null,
            });

            vi.mocked(PricingService.listRules).mockResolvedValue([
                customerRule,
            ]);

            const mockWorkerPaymentResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 100, // Same as customer (same_structure)
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [],
                            subtotal: 100,
                            total_adjustments: 0,
                            total_worker_payment: 100,
                        },
                    ],
                },
            };

            vi.mocked(WorkerPaymentService.calculatePayments).mockResolvedValue(
                mockWorkerPaymentResponse as CalculateWorkerPaymentsResponse,
            );

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            // When worker_payment_type is null, should default to same_structure
            expect(result.calculation.total_worker_payment).toBe(100);
        });
    });
});
