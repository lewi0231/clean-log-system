/**
 * API Integration Tests: Payment Link Creation
 *
 * These tests verify integration between the dashboard and Edge Functions
 * with real Stripe Test Mode API calls.
 *
 * Requirements:
 * - Stripe test API keys must be set in environment variables
 * - Supabase Edge Functions should be running (or use MSW to mock)
 * - Test database should be available
 *
 * Run with: npm test -- payment-link-creation
 */

import { createPaymentLink } from "@/lib/stripe";
import Stripe from "stripe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock Supabase database calls but allow real Stripe API calls
vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

// Mock fetch for Edge Function calls - we'll override this in specific tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Payment Link Creation - API Integration", () => {
    let stripe: Stripe;
    const testInvoiceId = "test-invoice-123";
    const testOrgId = "test-org-123";
    const testSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "http://localhost:54321";

    beforeAll(() => {
        // Initialize Stripe with test key
        const stripeTestKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeTestKey || !stripeTestKey.startsWith("sk_test_")) {
            throw new Error(
                "STRIPE_SECRET_KEY environment variable must be set with a test key (sk_test_...)",
            );
        }
        stripe = new Stripe(stripeTestKey, {
            apiVersion: "2025-11-17.clover",
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Stripe Checkout Session Creation", () => {
        it("should create a real Stripe Checkout Session in test mode", async () => {
            const amount = 1000; // $10.00 in cents
            const currency = "aud";

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: currency,
                            product_data: {
                                name: "Test Invoice",
                            },
                            unit_amount: amount,
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
                metadata: {
                    invoice_id: testInvoiceId,
                    invoice_number: "TEST-INV-001",
                    organization_id: testOrgId,
                },
                expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours (Stripe's maximum)
            });

            expect(session.id).toBeTruthy();
            expect(session.id).toMatch(/^cs_test_/);
            expect(session.url).toMatch(/checkout\.stripe\.com/);
            expect(session.metadata?.invoice_id).toBe(testInvoiceId);
            expect(session.status).toBe("open");

            // Cleanup: expire the session
            await stripe.checkout.sessions.expire(session.id);
        });

        it("should create Checkout Session with correct amount and currency", async () => {
            const amount = 5000; // $50.00 in cents
            const currency = "usd";

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: currency,
                            product_data: {
                                name: "Test Invoice USD",
                            },
                            unit_amount: amount,
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
                metadata: {
                    invoice_id: testInvoiceId,
                    organization_id: testOrgId,
                },
            });

            expect(session.amount_total).toBe(amount);
            expect(session.currency).toBe(currency);
            expect(session.payment_status).toBe("unpaid");

            // Cleanup
            await stripe.checkout.sessions.expire(session.id);
        });

        it("should include correct metadata in Checkout Session", async () => {
            const metadata = {
                invoice_id: testInvoiceId,
                invoice_number: "INV-2025-001",
                organization_id: testOrgId,
            };

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "aud",
                            product_data: {
                                name: "Test Invoice",
                            },
                            unit_amount: 1000,
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
                metadata,
            });

            expect(session.metadata).toEqual(metadata);

            // Cleanup
            await stripe.checkout.sessions.expire(session.id);
        });

        it("should set correct expiry time (24 hours from now)", async () => {
            const now = Math.floor(Date.now() / 1000);
            const expectedExpiry = now + 24 * 60 * 60; // 24 hours (Stripe's maximum)

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "aud",
                            product_data: {
                                name: "Test Invoice",
                            },
                            unit_amount: 1000,
                        },
                        quantity: 1,
                    },
                ],
                success_url: "https://example.com/success",
                cancel_url: "https://example.com/cancel",
                metadata: {
                    invoice_id: testInvoiceId,
                    organization_id: testOrgId,
                },
                expires_at: expectedExpiry,
            });

            expect(session.expires_at).toBe(expectedExpiry);

            // Cleanup
            await stripe.checkout.sessions.expire(session.id);
        });
    });

    describe("Edge Function Integration", () => {
        it("should successfully call create-payment-link edge function", async () => {
            // Mock successful Edge Function response
            const mockCheckoutUrl = "https://checkout.stripe.com/test";

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    payment_link: {
                        id: "plink-test-123",
                        url: mockCheckoutUrl,
                        status: "open",
                    },
                }),
            });

            // Mock Supabase response for payment link lookup
            const { supabase } = await import("@/lib/supabase");
            vi.mocked(supabase.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: {
                        status: "open",
                        expires_at: new Date(
                            Date.now() + 30 * 24 * 60 * 60 * 1000,
                        ).toISOString(),
                    },
                    error: null,
                }),
            } as unknown as ReturnType<typeof supabase.from>);

            const result = await createPaymentLink({
                invoiceId: testInvoiceId,
                organizationId: testOrgId,
                successUrl: "https://example.com/success",
                cancelUrl: "https://example.com/cancel",
            });

            expect(result.url).toBe(mockCheckoutUrl);
            expect(result.id).toBe("plink-test-123");
            expect(mockFetch).toHaveBeenCalledWith(
                `${testSupabaseUrl}/functions/v1/create-payment-link`,
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                    }),
                    body: expect.stringContaining(testInvoiceId),
                }),
            );
        });

        it("should handle Edge Function errors gracefully", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({
                    error: "Invoice not found",
                }),
            });

            await expect(
                createPaymentLink({
                    invoiceId: "non-existent-invoice",
                    organizationId: testOrgId,
                }),
            ).rejects.toThrow("Invoice not found");
        });

        it("should handle network errors", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            await expect(
                createPaymentLink({
                    invoiceId: testInvoiceId,
                    organizationId: testOrgId,
                }),
            ).rejects.toThrow("Network error");
        });

        it("should include success and cancel URLs in request", async () => {
            const successUrl = "https://example.com/success?invoice=123";
            const cancelUrl = "https://example.com/cancel?invoice=123";

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    payment_link: {
                        id: "plink-test",
                        url: "https://checkout.stripe.com/test",
                        status: "open",
                    },
                }),
            });

            const { supabase } = await import("@/lib/supabase");
            vi.mocked(supabase.from).mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { status: "open", expires_at: null },
                    error: null,
                }),
            } as unknown as ReturnType<typeof supabase.from>);

            await createPaymentLink({
                invoiceId: testInvoiceId,
                organizationId: testOrgId,
                successUrl,
                cancelUrl,
            });

            const callBody = JSON.parse(
                mockFetch.mock.calls[0][1]?.body as string,
            );
            expect(callBody.success_url).toBe(successUrl);
            expect(callBody.cancel_url).toBe(cancelUrl);
        });
    });

    describe("Error Handling", () => {
        it("should handle invalid Stripe API key", async () => {
            const invalidStripe = new Stripe("sk_test_invalid_key", {
                apiVersion: "2025-11-17.clover",
            });

            await expect(
                invalidStripe.checkout.sessions.create({
                    mode: "payment",
                    payment_method_types: ["card"],
                    line_items: [
                        {
                            price_data: {
                                currency: "aud",
                                product_data: { name: "Test" },
                                unit_amount: 1000,
                            },
                            quantity: 1,
                        },
                    ],
                    success_url: "https://example.com/success",
                    cancel_url: "https://example.com/cancel",
                }),
            ).rejects.toThrow();
        });

        it("should handle missing required fields", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    error: "Missing required fields: invoice_id",
                }),
            });

            await expect(
                createPaymentLink({
                    invoiceId: "",
                    organizationId: testOrgId,
                }),
            ).rejects.toThrow();
        });
    });
});
