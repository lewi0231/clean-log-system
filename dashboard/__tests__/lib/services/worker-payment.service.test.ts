import type {
    CalculateWorkerPaymentsResponse,
    PaymentRecord,
} from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
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
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("WorkerPaymentService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("calculatePayments", () => {
        it("should calculate worker payments successfully", async () => {
            const mockResponse: CalculateWorkerPaymentsResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 150,
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [
                                {
                                    field_config_id: "field-1",
                                    field_name: "test_field",
                                    field_label: "Test Field",
                                    quantity: 2,
                                    unit_price: 50,
                                    total: 100,
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
                                    metadata: {},
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

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1"],
            });

            expect(result).toEqual(mockResponse);
            expect(result.calculation.total_worker_payment).toBe(150);
            expect(result.calculation.job_calculations).toHaveLength(1);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "calculate-worker-payment",
                {
                    body: {
                        organization_id: "org-1",
                        job_ids: ["job-1"],
                    },
                },
            );
        });

        it("should handle errors when calculating payments", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Failed to calculate" },
            });

            await expect(
                WorkerPaymentService.calculatePayments({
                    organization_id: "org-1",
                    job_ids: ["job-1"],
                }),
            ).rejects.toThrow();
        });

        it("should handle unsuccessful response", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(
                WorkerPaymentService.calculatePayments({
                    organization_id: "org-1",
                    job_ids: ["job-1"],
                }),
            ).rejects.toThrow("Failed to calculate worker payments");
        });

        it("should calculate payments for multiple jobs", async () => {
            const mockResponse: CalculateWorkerPaymentsResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 300,
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
                            subtotal: 200,
                            total_adjustments: 0,
                            total_worker_payment: 200,
                        },
                    ],
                },
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await WorkerPaymentService.calculatePayments({
                organization_id: "org-1",
                job_ids: ["job-1", "job-2"],
            });

            expect(result.calculation.job_calculations).toHaveLength(2);
            expect(result.calculation.total_worker_payment).toBe(300);
        });
    });

    describe("exportPaymentsToCSV", () => {
        it("should export payments to CSV format", () => {
            const payment: PaymentRecord = {
                id: "payment-1",
                dateRange: {
                    start: "2024-01-01",
                    end: "2024-01-31",
                },
                jobIds: ["job-1", "job-2"],
                totalPayment: 300,
                workerCount: 2,
                calculatedAt: "2024-01-15T10:00:00Z",
                calculation: {
                    success: true,
                    calculation: {
                        total_worker_payment: 300,
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
                                subtotal: 200,
                                total_adjustments: 0,
                                total_worker_payment: 200,
                            },
                        ],
                    },
                },
            };

            const jobs = [
                {
                    id: "job-1",
                    workers: [{ name: "John Doe" }],
                },
                {
                    id: "job-2",
                    workers: [{ name: "Jane Smith" }],
                },
            ];

            const csv = WorkerPaymentService.exportPaymentsToCSV(payment, jobs);

            expect(csv).toContain("Job ID");
            expect(csv).toContain("Total Payment");
            expect(csv).toContain("Workers");
            expect(csv).toContain("job-1");
            expect(csv).toContain("100");
            expect(csv).toContain("John Doe");
            expect(csv).toContain("job-2");
            expect(csv).toContain("200");
            expect(csv).toContain("Jane Smith");
        });

        it("should handle jobs without workers", () => {
            const payment: PaymentRecord = {
                id: "payment-1",
                dateRange: {
                    start: "2024-01-01",
                    end: "2024-01-31",
                },
                jobIds: ["job-1"],
                totalPayment: 100,
                workerCount: 0,
                calculatedAt: "2024-01-15T10:00:00Z",
                calculation: {
                    success: true,
                    calculation: {
                        total_worker_payment: 100,
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
                },
            };

            const jobs = [
                {
                    id: "job-1",
                    workers: [],
                },
            ];

            const csv = WorkerPaymentService.exportPaymentsToCSV(payment, jobs);

            expect(csv).toContain("job-1");
            expect(csv).toContain("100");
        });
    });

    describe("aggregateByWorker", () => {
        it("should aggregate payments by worker", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: ["job-1", "job-2"],
                    totalPayment: 300,
                    workerCount: 2,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 300,
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
                                    subtotal: 200,
                                    total_adjustments: 0,
                                    total_worker_payment: 200,
                                },
                            ],
                        },
                    },
                },
            ];

            const jobs = [
                {
                    id: "job-1",
                    workers: [
                        { id: "worker-1", name: "John Doe" },
                    ],
                },
                {
                    id: "job-2",
                    workers: [
                        { id: "worker-1", name: "John Doe" },
                        { id: "worker-2", name: "Jane Smith" },
                    ],
                },
            ];

            const summaries = WorkerPaymentService.aggregateByWorker(
                payments,
                jobs,
            );

            expect(summaries).toHaveLength(2);
            const johnSummary = summaries.find((s) =>
                s.workerId === "worker-1"
            );
            const janeSummary = summaries.find((s) =>
                s.workerId === "worker-2"
            );

            expect(johnSummary).toBeDefined();
            expect(johnSummary?.jobCount).toBe(2);
            expect(johnSummary?.totalPayment).toBe(300); // 100 + 200
            expect(johnSummary?.averagePayment).toBe(150); // 300 / 2

            expect(janeSummary).toBeDefined();
            expect(janeSummary?.jobCount).toBe(1);
            expect(janeSummary?.totalPayment).toBe(200);
            expect(janeSummary?.averagePayment).toBe(200);
        });

        it("should sort workers by total payment descending", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: ["job-1", "job-2"],
                    totalPayment: 300,
                    workerCount: 2,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 300,
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
                                    subtotal: 200,
                                    total_adjustments: 0,
                                    total_worker_payment: 200,
                                },
                            ],
                        },
                    },
                },
            ];

            const jobs = [
                {
                    id: "job-1",
                    workers: [{ id: "worker-1", name: "John Doe" }],
                },
                {
                    id: "job-2",
                    workers: [{ id: "worker-2", name: "Jane Smith" }],
                },
            ];

            const summaries = WorkerPaymentService.aggregateByWorker(
                payments,
                jobs,
            );

            expect(summaries[0].totalPayment).toBeGreaterThanOrEqual(
                summaries[1].totalPayment,
            );
        });
    });

    describe("filterByDateRange", () => {
        it("should filter payments by start date", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: [],
                    totalPayment: 100,
                    workerCount: 0,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 100,
                            job_calculations: [],
                        },
                    },
                },
                {
                    id: "payment-2",
                    dateRange: {
                        start: "2024-02-01",
                        end: "2024-02-28",
                    },
                    jobIds: [],
                    totalPayment: 200,
                    workerCount: 0,
                    calculatedAt: "2024-02-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 200,
                            job_calculations: [],
                        },
                    },
                },
            ];

            const filtered = WorkerPaymentService.filterByDateRange(
                payments,
                "2024-02-01",
            );

            expect(filtered).toHaveLength(1);
            expect(filtered[0].id).toBe("payment-2");
        });

        it("should filter payments by end date", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: [],
                    totalPayment: 100,
                    workerCount: 0,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 100,
                            job_calculations: [],
                        },
                    },
                },
                {
                    id: "payment-2",
                    dateRange: {
                        start: "2024-02-01",
                        end: "2024-02-28",
                    },
                    jobIds: [],
                    totalPayment: 200,
                    workerCount: 0,
                    calculatedAt: "2024-02-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 200,
                            job_calculations: [],
                        },
                    },
                },
            ];

            const filtered = WorkerPaymentService.filterByDateRange(
                payments,
                undefined,
                "2024-01-31",
            );

            expect(filtered).toHaveLength(1);
            expect(filtered[0].id).toBe("payment-1");
        });

        it("should filter payments by date range", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: [],
                    totalPayment: 100,
                    workerCount: 0,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 100,
                            job_calculations: [],
                        },
                    },
                },
                {
                    id: "payment-2",
                    dateRange: {
                        start: "2024-02-01",
                        end: "2024-02-28",
                    },
                    jobIds: [],
                    totalPayment: 200,
                    workerCount: 0,
                    calculatedAt: "2024-02-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 200,
                            job_calculations: [],
                        },
                    },
                },
            ];

            const filtered = WorkerPaymentService.filterByDateRange(
                payments,
                "2024-01-15",
                "2024-02-15",
            );

            expect(filtered).toHaveLength(2);
        });

        it("should return all payments when no date range specified", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: [],
                    totalPayment: 100,
                    workerCount: 0,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 100,
                            job_calculations: [],
                        },
                    },
                },
            ];

            const filtered = WorkerPaymentService.filterByDateRange(payments);

            expect(filtered).toHaveLength(1);
        });
    });

    describe("filterByWorker", () => {
        it("should filter payments by worker", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: ["job-1", "job-2"],
                    totalPayment: 300,
                    workerCount: 2,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 300,
                            job_calculations: [],
                        },
                    },
                },
            ];

            const jobs = [
                {
                    id: "job-1",
                    workers: [{ id: "worker-1" }],
                },
                {
                    id: "job-2",
                    workers: [{ id: "worker-2" }],
                },
            ];

            const filtered = WorkerPaymentService.filterByWorker(
                payments,
                "worker-1",
                jobs,
            );

            expect(filtered).toHaveLength(1);
            expect(filtered[0].id).toBe("payment-1");
        });

        it("should return empty array when worker has no jobs", () => {
            const payments: PaymentRecord[] = [
                {
                    id: "payment-1",
                    dateRange: {
                        start: "2024-01-01",
                        end: "2024-01-31",
                    },
                    jobIds: ["job-1"],
                    totalPayment: 100,
                    workerCount: 1,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 100,
                            job_calculations: [],
                        },
                    },
                },
            ];

            const jobs = [
                {
                    id: "job-1",
                    workers: [{ id: "worker-2" }],
                },
            ];

            const filtered = WorkerPaymentService.filterByWorker(
                payments,
                "worker-1",
                jobs,
            );

            expect(filtered).toHaveLength(0);
        });
    });

    describe("savePayment", () => {
        it("should save worker payment successfully", async () => {
            const mockResponse = {
                success: true,
                batch_id: "batch-123",
                payment_count: 2,
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const calculation: CalculateWorkerPaymentsResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 200,
                    job_calculations: [
                        {
                            job_id: "job-1",
                            line_items: [],
                            applied_rules: [],
                            subtotal: 200,
                            total_adjustments: 0,
                            total_worker_payment: 200,
                        },
                    ],
                },
            };

            const result = await WorkerPaymentService.savePayment(
                "org-1",
                calculation,
                ["job-1"],
            );

            expect(result.success).toBe(true);
            expect(result.batch_id).toBe("batch-123");
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "save-worker-payment",
                {
                    body: {
                        organization_id: "org-1",
                        calculation: calculation.calculation,
                        job_ids: ["job-1"],
                    },
                },
            );
        });

        it("should throw error when save fails", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Save failed" },
            });

            const calculation: CalculateWorkerPaymentsResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 100,
                    job_calculations: [],
                },
            };

            await expect(
                WorkerPaymentService.savePayment("org-1", calculation, [
                    "job-1",
                ]),
            ).rejects.toThrow();
        });

        it("should throw error when response is unsuccessful", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            const calculation: CalculateWorkerPaymentsResponse = {
                success: true,
                calculation: {
                    total_worker_payment: 100,
                    job_calculations: [],
                },
            };

            await expect(
                WorkerPaymentService.savePayment("org-1", calculation, [
                    "job-1",
                ]),
            ).rejects.toThrow("Failed to save worker payment");
        });
    });

    describe("updatePaymentStatus", () => {
        it("should update payment status to paid", async () => {
            const mockResponse = {
                success: true,
                batch: { id: "batch-123", status: "completed" },
            };

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await WorkerPaymentService.updatePaymentStatus(
                "org-1",
                {
                    batchId: "batch-123",
                    status: "paid",
                    paymentMethod: "bank_transfer",
                    paymentReference: "TXN-001",
                    notes: "Paid via bank",
                },
            );

            expect(result.success).toBe(true);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "update-worker-payment-status",
                {
                    body: {
                        organization_id: "org-1",
                        payment_id: undefined,
                        batch_id: "batch-123",
                        status: "paid",
                        payment_method: "bank_transfer",
                        payment_reference: "TXN-001",
                        notes: "Paid via bank",
                    },
                },
            );
        });

        it("should update individual payment status", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    payment: { id: "payment-1", status: "paid" },
                },
                error: null,
            });

            const result = await WorkerPaymentService.updatePaymentStatus(
                "org-1",
                {
                    paymentId: "payment-1",
                    status: "paid",
                    paymentMethod: "cash",
                },
            );

            expect(result.success).toBe(true);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "update-worker-payment-status",
                expect.objectContaining({
                    body: expect.objectContaining({
                        payment_id: "payment-1",
                        status: "paid",
                    }),
                }),
            );
        });

        it("should throw error when update fails", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Update failed" },
            });

            await expect(
                WorkerPaymentService.updatePaymentStatus("org-1", {
                    batchId: "batch-1",
                    status: "paid",
                }),
            ).rejects.toThrow();
        });

        it("should handle status transitions: calculated to approved", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, batch: { status: "approved" } },
                error: null,
            });

            const result = await WorkerPaymentService.updatePaymentStatus(
                "org-1",
                { batchId: "batch-1", status: "approved" },
            );

            expect(result.success).toBe(true);
        });

        it("should handle status transitions: approved to processing", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, batch: { status: "processing" } },
                error: null,
            });

            const result = await WorkerPaymentService.updatePaymentStatus(
                "org-1",
                { batchId: "batch-1", status: "processing" },
            );

            expect(result.success).toBe(true);
        });
    });

    describe("listPayments", () => {
        it("should list worker payments successfully", async () => {
            const mockBatches: PaymentRecord[] = [
                {
                    id: "batch-1",
                    batch_id: "batch-1",
                    dateRange: { start: "2024-01-01", end: "2024-01-31" },
                    jobIds: ["job-1", "job-2"],
                    totalPayment: 500,
                    workerCount: 3,
                    calculatedAt: "2024-01-15T10:00:00Z",
                    status: "calculated",
                    calculation: {
                        success: true,
                        calculation: {
                            total_worker_payment: 500,
                            job_calculations: [],
                        },
                    },
                },
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    batches: mockBatches,
                    total: 1,
                    hasMore: false,
                },
                error: null,
            });

            const result = await WorkerPaymentService.listPayments("org-1");

            expect(result.payments).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.hasMore).toBe(false);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-worker-payments",
                {
                    body: {
                        organization_id: "org-1",
                        page: 1,
                        limit: 50,
                    },
                },
            );
        });

        it("should support pagination", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    batches: [],
                    total: 100,
                    hasMore: true,
                },
                error: null,
            });

            const result = await WorkerPaymentService.listPayments("org-1", {
                page: 2,
                limit: 20,
            });

            expect(result.hasMore).toBe(true);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-worker-payments",
                {
                    body: {
                        organization_id: "org-1",
                        page: 2,
                        limit: 20,
                    },
                },
            );
        });

        it("should throw error when list fails", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "List failed" },
            });

            await expect(
                WorkerPaymentService.listPayments("org-1"),
            ).rejects.toThrow();
        });

        it("should return empty array when no payments exist", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: {
                    success: true,
                    batches: [],
                    total: 0,
                    hasMore: false,
                },
                error: null,
            });

            const result = await WorkerPaymentService.listPayments("org-1");

            expect(result.payments).toEqual([]);
            expect(result.total).toBe(0);
        });
    });
});
