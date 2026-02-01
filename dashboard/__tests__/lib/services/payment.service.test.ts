import { PaymentService } from "@/lib/services/payment.service";
import { createPaymentLink } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPayment, createMockPaymentLink } from "../fixtures";

vi.mock("@/lib/stripe", () => ({
    createPaymentLink: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
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

describe("PaymentService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createPaymentLink", () => {
        it("should create payment link successfully", async () => {
            const mockLink = {
                id: "plink-1",
                url: "https://checkout.stripe.com/test",
            };
            const mockPaymentLink = createMockPaymentLink({
                id: "plink-1",
                status: "open",
            });

            vi.mocked(createPaymentLink).mockResolvedValue(mockLink);

            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockReturnThis();
            const mockSingle = vi.fn().mockResolvedValue({
                data: mockPaymentLink,
                error: null,
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                eq: mockEq,
                single: mockSingle,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.createPaymentLink({
                invoice_id: "invoice-1",
                organization_id: "org-1",
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
            });

            expect(result.id).toBe("plink-1");
            expect(result.url).toBe("https://checkout.stripe.com/test");
            expect(result.status).toBe("open");
            expect(createPaymentLink).toHaveBeenCalledWith({
                invoiceId: "invoice-1",
                organizationId: "org-1",
                successUrl: "https://example.com/success",
                cancelUrl: "https://example.com/cancel",
            });
        });

        it("should handle error when creating payment link fails", async () => {
            const mockError = new Error("Failed to create link");
            vi.mocked(createPaymentLink).mockRejectedValue(mockError);

            await expect(
                PaymentService.createPaymentLink({
                    invoice_id: "invoice-1",
                    organization_id: "org-1",
                }),
            ).rejects.toThrow("Failed to create link");
        });

        it("should return default status if payment link not found in DB", async () => {
            const mockLink = {
                id: "plink-1",
                url: "https://checkout.stripe.com/test",
            };

            vi.mocked(createPaymentLink).mockResolvedValue(mockLink);

            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockReturnThis();
            const mockSingle = vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                eq: mockEq,
                single: mockSingle,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.createPaymentLink({
                invoice_id: "invoice-1",
                organization_id: "org-1",
            });

            expect(result.status).toBe("open");
            expect(result.id).toBe("plink-1");
        });
    });

    describe("list", () => {
        it("should list payments for organization", async () => {
            const mockPayments = [
                createMockPayment(),
                createMockPayment({ id: "payment-2", amount: 500.0 }),
            ];

            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockReturnThis();
            const mockOrder = vi.fn().mockResolvedValue({
                data: mockPayments,
                error: null,
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                eq: mockEq,
                order: mockOrder,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual(mockPayments);
            expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
        });

        it("should filter payments by invoice_id", async () => {
            const mockPayments = [createMockPayment()];

            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockReturnThis();
            const mockOrder = vi.fn().mockResolvedValue({
                data: mockPayments,
                error: null,
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                eq: mockEq,
                order: mockOrder,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.list({
                organization_id: "org-1",
                invoice_id: "invoice-1",
            });

            expect(result).toEqual(mockPayments);
            expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
            expect(mockEq).toHaveBeenCalledWith("invoice_id", "invoice-1");
        });

        it("should handle empty payment list", async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockReturnThis();
            const mockOrder = vi.fn().mockResolvedValue({
                data: [],
                error: null,
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                eq: mockEq,
                order: mockOrder,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.list({
                organization_id: "org-1",
            });

            expect(result).toEqual([]);
        });

        it("should handle database errors", async () => {
            const mockError = { message: "Database error", status: 500 };

            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockReturnThis();
            const mockOrder = vi.fn().mockResolvedValue({
                data: null,
                error: mockError,
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockSelect,
                eq: mockEq,
                order: mockOrder,
            } as unknown as ReturnType<typeof supabase.from>);

            await expect(
                PaymentService.list({
                    organization_id: "org-1",
                }),
            ).rejects.toMatchObject(mockError);
        });
    });

    describe("getPaymentLink", () => {
        it("should get payment link for invoice", async () => {
            const mockPaymentLink = createMockPaymentLink();

            const mockInvoiceSelect = vi.fn().mockReturnThis();
            const mockInvoiceEq = vi.fn().mockReturnThis();
            const mockInvoiceSingle = vi.fn().mockResolvedValue({
                data: { payment_link_id: "plink-1" },
                error: null,
            });

            const mockLinkSelect = vi.fn().mockReturnThis();
            const mockLinkEq = vi.fn().mockReturnThis();
            const mockLinkSingle = vi.fn().mockResolvedValue({
                data: mockPaymentLink,
                error: null,
            });

            vi.mocked(supabase.from)
                .mockReturnValueOnce({
                    select: mockInvoiceSelect,
                    eq: mockInvoiceEq,
                    single: mockInvoiceSingle,
                } as unknown as ReturnType<typeof supabase.from>)
                .mockReturnValueOnce({
                    select: mockLinkSelect,
                    eq: mockLinkEq,
                    single: mockLinkSingle,
                } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.getPaymentLink("invoice-1");

            expect(result).toEqual({
                id: "plink-1",
                url: "https://checkout.stripe.com/test",
                status: "open",
            });
        });

        it("should return null if invoice has no payment link", async () => {
            const mockInvoiceSelect = vi.fn().mockReturnThis();
            const mockInvoiceEq = vi.fn().mockReturnThis();
            const mockInvoiceSingle = vi.fn().mockResolvedValue({
                data: { payment_link_id: null },
                error: null,
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockInvoiceSelect,
                eq: mockInvoiceEq,
                single: mockInvoiceSingle,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.getPaymentLink("invoice-1");

            expect(result).toBeNull();
        });

        it("should return null if invoice not found", async () => {
            const mockInvoiceSelect = vi.fn().mockReturnThis();
            const mockInvoiceEq = vi.fn().mockReturnThis();
            const mockInvoiceSingle = vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
            });

            vi.mocked(supabase.from).mockReturnValue({
                select: mockInvoiceSelect,
                eq: mockInvoiceEq,
                single: mockInvoiceSingle,
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.getPaymentLink("invoice-1");

            expect(result).toBeNull();
        });
    });

    describe("createManualPayment", () => {
        it("should create manual payment successfully", async () => {
            const mockPayment = createMockPayment({
                payment_method: "bank_transfer_manual",
                payment_reference: "TRANS-123",
                status: "succeeded",
            });

            const mockInvoice = {
                id: "invoice-1",
                total: 1000.0,
                total_paid: 0,
                payment_count: 0,
                status: "sent",
            };

            const mockInsert = vi.fn().mockReturnThis();
            const mockInsertSelect = vi.fn().mockReturnThis();
            const mockInsertSingle = vi.fn().mockResolvedValue({
                data: mockPayment,
                error: null,
            });

            const mockInvoiceSelect = vi.fn().mockReturnThis();
            const mockInvoiceEq = vi.fn().mockReturnThis();
            const mockInvoiceSingle = vi.fn().mockResolvedValue({
                data: mockInvoice,
                error: null,
            });

            const mockInvoiceUpdate = vi.fn().mockReturnThis();
            const mockInvoiceUpdateEq = vi.fn().mockResolvedValue({
                error: null,
            });

            vi.mocked(supabase.from)
                .mockReturnValueOnce({
                    insert: mockInsert,
                    select: mockInsertSelect,
                    single: mockInsertSingle,
                } as unknown as ReturnType<typeof supabase.from>)
                .mockReturnValueOnce({
                    select: mockInvoiceSelect,
                    eq: mockInvoiceEq,
                    single: mockInvoiceSingle,
                } as unknown as ReturnType<typeof supabase.from>)
                .mockReturnValueOnce({
                    update: mockInvoiceUpdate,
                    eq: mockInvoiceUpdateEq,
                } as unknown as ReturnType<typeof supabase.from>);

            const result = await PaymentService.createManualPayment({
                invoice_id: "invoice-1",
                organization_id: "org-1",
                amount: 1000.0,
                currency: "AUD",
                payment_reference: "TRANS-123",
                payment_date: "2025-01-15",
                notes: "Bank transfer",
            });

            expect(result.id).toBe("payment-1");
            expect(result.payment_method).toBe("bank_transfer_manual");
            expect(result.payment_reference).toBe("TRANS-123");
        });

        it("should update invoice status to paid when fully paid", async () => {
            const mockPayment = createMockPayment();
            const mockInvoice = {
                id: "invoice-1",
                total: 1000.0,
                total_paid: 0,
                payment_count: 0,
                status: "sent",
            };

            const mockInsert = vi.fn().mockReturnThis();
            const mockInsertSelect = vi.fn().mockReturnThis();
            const mockInsertSingle = vi.fn().mockResolvedValue({
                data: mockPayment,
                error: null,
            });

            const mockInvoiceSelect = vi.fn().mockReturnThis();
            const mockInvoiceEq = vi.fn().mockReturnThis();
            const mockInvoiceSingle = vi.fn().mockResolvedValue({
                data: mockInvoice,
                error: null,
            });

            const mockInvoiceUpdate = vi.fn().mockReturnThis();
            const mockInvoiceUpdateEq = vi.fn().mockResolvedValue({
                error: null,
            });

            vi.mocked(supabase.from)
                .mockReturnValueOnce({
                    insert: mockInsert,
                    select: mockInsertSelect,
                    single: mockInsertSingle,
                } as unknown as ReturnType<typeof supabase.from>)
                .mockReturnValueOnce({
                    select: mockInvoiceSelect,
                    eq: mockInvoiceEq,
                    single: mockInvoiceSingle,
                } as unknown as ReturnType<typeof supabase.from>)
                .mockReturnValueOnce({
                    update: mockInvoiceUpdate,
                    eq: mockInvoiceUpdateEq,
                } as unknown as ReturnType<typeof supabase.from>);

            await PaymentService.createManualPayment({
                invoice_id: "invoice-1",
                organization_id: "org-1",
                amount: 1000.0,
                currency: "AUD",
                payment_reference: "TRANS-123",
                payment_date: "2025-01-15",
            });

            expect(mockInvoiceUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    total_paid: 1000.0,
                    payment_count: 1,
                    status: "paid",
                    paid_at: expect.any(String),
                }),
            );
        });

        it("should handle payment insertion errors", async () => {
            const mockError = { message: "Insert failed", status: 500 };

            const mockInsert = vi.fn().mockReturnThis();
            const mockInsertSelect = vi.fn().mockReturnThis();
            const mockInsertSingle = vi.fn().mockResolvedValue({
                data: null,
                error: mockError,
            });

            vi.mocked(supabase.from).mockReturnValue({
                insert: mockInsert,
                select: mockInsertSelect,
                single: mockInsertSingle,
            } as unknown as ReturnType<typeof supabase.from>);

            await expect(
                PaymentService.createManualPayment({
                    invoice_id: "invoice-1",
                    organization_id: "org-1",
                    amount: 1000.0,
                    currency: "AUD",
                    payment_reference: "TRANS-123",
                    payment_date: "2025-01-15",
                }),
            ).rejects.toMatchObject(mockError);
        });
    });
});
