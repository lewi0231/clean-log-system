/**
 * Test helpers for Stripe integration tests
 */

import type Stripe from "stripe";

/**
 * Create a test Stripe webhook event payload
 * @param type - The Stripe event type
 * @param data - The event data (can be any event data type for testing)
 */
export function createTestWebhookEvent(
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any, // Using any for flexibility in test data creation
): Stripe.Event {
    return {
        id: `evt_test_${Date.now()}`,
        object: "event",
        api_version: "2025-11-17.clover",
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 1,
        request: {
            id: `req_test_${Date.now()}`,
            idempotency_key: null,
        },
        type: type as Stripe.Event.Type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
    } as Stripe.Event;
}

/**
 * Create a test checkout.session.completed event
 */
export function createCheckoutSessionCompletedEvent(
    sessionId: string,
    invoiceId: string,
    organizationId: string,
    amount: number = 1000,
    currency: string = "aud",
): Stripe.Event {
    return createTestWebhookEvent("checkout.session.completed", {
        object: {
            id: sessionId,
            object: "checkout.session",
            amount_total: amount,
            currency: currency,
            payment_status: "paid",
            status: "complete",
            customer_email: "test@example.com",
            metadata: {
                invoice_id: invoiceId,
                invoice_number: "TEST-INV-001",
                organization_id: organizationId,
            },
            payment_intent: `pi_test_${Date.now()}`,
            url: `https://checkout.stripe.com/c/pay/${sessionId}`,
        } as unknown as Stripe.Checkout.Session,
        previous_attributes: undefined,
    });
}

/**
 * Create a test payment_intent.succeeded event
 */
export function createPaymentIntentSucceededEvent(
    paymentIntentId: string,
    invoiceId: string,
    amount: number = 1000,
    currency: string = "aud",
): Stripe.Event {
    return createTestWebhookEvent("payment_intent.succeeded", {
        object: {
            id: paymentIntentId,
            object: "payment_intent",
            amount: amount,
            currency: currency,
            status: "succeeded",
            metadata: {
                invoice_id: invoiceId,
            },
        } as unknown as Stripe.PaymentIntent,
        previous_attributes: undefined,
    });
}

/**
 * Create a test charge.refunded event
 */
export function createChargeRefundedEvent(
    chargeId: string,
    paymentIntentId: string,
    invoiceId: string,
    amount: number = 1000,
    refundedAmount: number = 1000,
): Stripe.Event {
    return createTestWebhookEvent("charge.refunded", {
        object: {
            id: chargeId,
            object: "charge",
            amount: amount,
            amount_refunded: refundedAmount,
            refunded: refundedAmount === amount,
            payment_intent: paymentIntentId,
            metadata: {
                invoice_id: invoiceId,
            },
        } as unknown as Stripe.Charge,
        previous_attributes: undefined,
    });
}

/**
 * Wait for a specified amount of time (for async operations)
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean up test Stripe resources
 */
export async function cleanupTestResources(
    stripe: Stripe,
    sessionIds: string[],
): Promise<void> {
    for (const sessionId of sessionIds) {
        try {
            await stripe.checkout.sessions.expire(sessionId);
        } catch (error) {
            // Ignore errors - session might already be expired or not exist
            console.warn(`Failed to expire session ${sessionId}:`, error);
        }
    }
}
