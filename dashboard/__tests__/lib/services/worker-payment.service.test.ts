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
});
