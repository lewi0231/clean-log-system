import { log } from "@/lib/logger";
import { createPaymentLink } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import type {
    CreateManualPaymentRequest,
    CreatePaymentLinkRequest,
    CreatePaymentLinkResponse,
    ListPaymentsRequest,
    Payment,
} from "@/lib/types/payment";

/**
 * Payment Service
 * Handles payment-related API calls and Stripe integration
 */
export class PaymentService {
    /**
     * Create a Stripe payment link for an invoice
     */
    static async createPaymentLink(
        request: CreatePaymentLinkRequest,
    ): Promise<CreatePaymentLinkResponse["payment_link"]> {
        try {
            log.debug("PaymentService: Creating payment link", {
                invoiceId: request.invoice_id,
                organizationId: request.organization_id,
            });

            // Use the Stripe utility which calls the edge function
            const { url, id } = await createPaymentLink({
                invoiceId: request.invoice_id,
                organizationId: request.organization_id,
                successUrl: request.success_url,
                cancelUrl: request.cancel_url,
            });

            log.info("PaymentService: Payment link created successfully", {
                paymentLinkId: id,
            });

            // Fetch payment link details from database for status
            const { data: paymentLink, error: linkError } = await supabase
                .from("payment_link")
                .select("status, expires_at")
                .eq("id", id)
                .single();

            if (linkError) {
                log.warn(
                    "PaymentService: Could not fetch payment link details",
                    {
                        error: linkError.message,
                    },
                );
            }

            return {
                id,
                url,
                status: (paymentLink?.status || "open") as
                    | "open"
                    | "complete"
                    | "expired"
                    | "canceled",
                expires_at: paymentLink?.expires_at || null,
            };
        } catch (err) {
            log.error("PaymentService: Failed to create payment link", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            throw err;
        }
    }

    /**
     * List payments for an organization, optionally filtered by invoice
     */
    static async list(
        request: ListPaymentsRequest,
    ): Promise<Payment[]> {
        try {
            log.debug("PaymentService: Listing payments", {
                organizationId: request.organization_id,
                invoiceId: request.invoice_id,
            });

            // Build query
            let query = supabase
                .from("payment")
                .select("*")
                .eq("organization_id", request.organization_id)
                .order("created_at", { ascending: false });

            if (request.invoice_id) {
                query = query.eq("invoice_id", request.invoice_id);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            log.info("PaymentService: Payments listed successfully", {
                paymentCount: data?.length || 0,
            });

            return (data || []) as Payment[];
        } catch (err) {
            log.error("PaymentService: Failed to list payments", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            throw err;
        }
    }

    /**
     * Get payment link for an invoice
     */
    static async getPaymentLink(
        invoiceId: string,
    ): Promise<{ id: string; url: string; status: string } | null> {
        try {
            log.debug("PaymentService: Getting payment link", {
                invoiceId,
            });

            const { data: invoice, error: invoiceError } = await supabase
                .from("invoice")
                .select("payment_link_id")
                .eq("id", invoiceId)
                .single();

            if (invoiceError || !invoice?.payment_link_id) {
                return null;
            }

            const { data: paymentLink, error: linkError } = await supabase
                .from("payment_link")
                .select("id, checkout_url, status")
                .eq("id", invoice.payment_link_id)
                .single();

            if (linkError || !paymentLink) {
                return null;
            }

            return {
                id: paymentLink.id,
                url: paymentLink.checkout_url,
                status: paymentLink.status,
            };
        } catch (err) {
            log.error("PaymentService: Failed to get payment link", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            return null;
        }
    }

    /**
     * Create a manual payment record (for bank transfers, etc.)
     */
    static async createManualPayment(
        request: CreateManualPaymentRequest,
    ): Promise<Payment> {
        try {
            log.debug("PaymentService: Creating manual payment", {
                invoiceId: request.invoice_id,
                amount: request.amount,
            });

            // Create payment record
            const { data: payment, error: paymentError } = await supabase
                .from("payment")
                .insert({
                    organization_id: request.organization_id,
                    invoice_id: request.invoice_id,
                    amount: request.amount,
                    currency: request.currency,
                    payment_method: "bank_transfer_manual",
                    payment_reference: request.payment_reference,
                    payment_date: request.payment_date,
                    status: "succeeded",
                    received_at: new Date().toISOString(),
                    fees: 0,
                    net_amount: request.amount,
                    metadata: {
                        notes: request.notes || null,
                        created_manually: true,
                    },
                })
                .select()
                .single();

            if (paymentError) {
                throw paymentError;
            }

            // Get invoice to update totals
            const { data: invoice, error: invoiceError } = await supabase
                .from("invoice")
                .select("id, total, total_paid, payment_count, status")
                .eq("id", request.invoice_id)
                .single();

            if (invoiceError || !invoice) {
                log.warn("PaymentService: Could not update invoice", {
                    error: invoiceError?.message,
                });
            } else {
                // Update invoice totals
                const newTotalPaid = (invoice.total_paid || 0) + request.amount;
                const newPaymentCount = (invoice.payment_count || 0) + 1;

                const { error: updateError } = await supabase
                    .from("invoice")
                    .update({
                        total_paid: newTotalPaid,
                        payment_count: newPaymentCount,
                        payment_method_used: "bank_transfer_manual",
                        status: newTotalPaid >= invoice.total
                            ? "paid"
                            : invoice.status,
                        paid_at: newTotalPaid >= invoice.total
                            ? new Date().toISOString()
                            : null,
                    })
                    .eq("id", request.invoice_id);

                if (updateError) {
                    log.warn("PaymentService: Error updating invoice", {
                        error: updateError.message,
                    });
                }
            }

            log.info("PaymentService: Manual payment created successfully");
            return payment as Payment;
        } catch (err) {
            log.error("PaymentService: Failed to create manual payment", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            throw err;
        }
    }
}
