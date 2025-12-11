/**
 * Payment-related types for Stripe integration
 */

export type PaymentMethod =
    | "stripe_checkout_card"
    | "stripe_checkout_bank"
    | "stripe_checkout_wallet"
    | "bank_transfer_manual"
    | "other";

export type PaymentStatus =
    | "pending"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled"
    | "refunded"
    | "partially_refunded"
    | "disputed";

export type PaymentLinkStatus = "open" | "complete" | "expired" | "canceled";

export interface Payment {
    id: string;
    organization_id: string;
    invoice_id: string | null;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    stripe_payment_intent_id: string | null;
    stripe_checkout_session_id: string | null;
    stripe_customer_id: string | null;
    stripe_charge_id: string | null;
    status: PaymentStatus;
    payment_reference: string | null;
    payment_date: string | null;
    received_at: string | null;
    fees: number;
    net_amount: number | null;
    reconciled_at: string | null;
    reconciled_by: string | null;
    reconciliation_notes: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, unknown>;
}

export interface PaymentLink {
    id: string;
    organization_id: string;
    invoice_id: string;
    stripe_checkout_session_id: string;
    checkout_url: string;
    status: PaymentLinkStatus;
    clicked_at: string | null;
    clicked_count: number;
    payment_completed_at: string | null;
    expires_at: string | null;
    customer_email: string | null;
    amount_total: number;
    created_at: string;
    updated_at: string;
}

export interface CreatePaymentLinkRequest {
    invoice_id: string;
    organization_id: string;
    success_url?: string;
    cancel_url?: string;
}

export interface CreatePaymentLinkResponse {
    success: boolean;
    payment_link: {
        id: string;
        url: string;
        status: PaymentLinkStatus;
        expires_at: string | null;
    };
    message?: string;
}

export interface ListPaymentsRequest {
    organization_id: string;
    invoice_id?: string;
}

export interface ListPaymentsResponse {
    success: boolean;
    payments: Payment[];
}

export interface CreateManualPaymentRequest {
    invoice_id: string;
    organization_id: string;
    amount: number;
    currency: string;
    payment_reference: string;
    payment_date: string;
    notes?: string;
}

export interface CreateManualPaymentResponse {
    success: boolean;
    payment: Payment;
}
