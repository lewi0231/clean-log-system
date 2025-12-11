/**
 * Stripe client utility for dashboard
 * Note: Only use publishable key in client-side code
 * Server-side Stripe operations should use edge functions
 */

// Stripe publishable key is used client-side for Stripe Elements/Checkout
// All actual payment processing happens server-side via edge functions

export const STRIPE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

if (!STRIPE_PUBLISHABLE_KEY && typeof window !== "undefined") {
    console.warn(
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe integration may not work.",
    );
}

/**
 * Create a payment link for an invoice
 * This calls the edge function to create a Stripe Checkout Session
 */
export async function createPaymentLink(params: {
    invoiceId: string;
    organizationId: string;
    successUrl?: string;
    cancelUrl?: string;
}): Promise<{ url: string; id: string }> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
    }

    const response = await fetch(
        `${supabaseUrl}/functions/v1/create-payment-link`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                invoice_id: params.invoiceId,
                organization_id: params.organizationId,
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
            }),
        },
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({
            error: "Failed to create payment link",
        }));
        throw new Error(error.error || "Failed to create payment link");
    }

    const data = await response.json();

    if (!data.success || !data.payment_link) {
        throw new Error(data.error || "Failed to create payment link");
    }

    return {
        url: data.payment_link.url,
        id: data.payment_link.id,
    };
}
