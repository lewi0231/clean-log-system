import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createStripeClient } from "../_utils/stripe.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface CreatePaymentLinkRequest extends Record<string, unknown> {
  invoice_id: string;
  organization_id: string;
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const body = await req.json() as CreatePaymentLinkRequest;
    const validation = validateRequiredFields(body, [
      "invoice_id",
      "organization_id",
    ]);

    if (!validation.valid) {
      const missingFields = validation.missingFields?.join(", ") || "unknown";
      return errorResponse(
        `Missing required fields: ${missingFields}`,
        400,
      );
    }

    const { invoice_id, organization_id, success_url, cancel_url } = body;

    const supabase = createServiceRoleClient();

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .select(
        "id, invoice_number, total, currency, organization_id, status, payment_link_id",
      )
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .single();

    if (invoiceError || !invoice) {
      return errorResponse("Invoice not found", 404);
    }

    // Check if invoice already has a payment link
    if (invoice.payment_link_id) {
      const { data: existingLink, error: linkError } = await supabase
        .from("payment_link")
        .select("id, checkout_url, status")
        .eq("id", invoice.payment_link_id)
        .single();

      if (!linkError && existingLink && existingLink.status === "open") {
        return jsonResponse({
          success: true,
          payment_link: {
            id: existingLink.id,
            url: existingLink.checkout_url,
            status: existingLink.status,
          },
          message: "Payment link already exists",
        });
      }
    }

    // Get organization settings for BSB/account details if needed (for future use)
    // const { data: organization } = await supabase
    //   .from("organization")
    //   .select("name, bsb, account_number, account_name")
    //   .eq("id", organization_id)
    //   .single();

    // Create Stripe Checkout Session
    const stripe = createStripeClient();

    // Determine base URL for success/cancel URLs
    const baseUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "link", "us_bank_account"], // Supports cards, digital wallets, and bank transfers
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase() || "aud",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(invoice.total * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: success_url ||
        `${baseUrl}/invoice/${invoice_id}?payment=success`,
      cancel_url: cancel_url ||
        `${baseUrl}/invoice/${invoice_id}?payment=cancelled`,
      metadata: {
        invoice_id: invoice_id,
        invoice_number: invoice.invoice_number,
        organization_id: organization_id,
      },
      customer_email: undefined, // Will be collected during checkout
      expires_at: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
    });

    // Store payment link in database
    const { data: paymentLink, error: linkInsertError } = await supabase
      .from("payment_link")
      .insert({
        organization_id,
        invoice_id,
        stripe_checkout_session_id: session.id,
        checkout_url: session.url!,
        status: "open",
        amount_total: invoice.total,
        expires_at: new Date(session.expires_at! * 1000).toISOString(),
      })
      .select()
      .single();

    if (linkInsertError) {
      console.error("Error creating payment link:", linkInsertError);
      throw linkInsertError;
    }

    // Update invoice with payment link reference
    const { error: invoiceUpdateError } = await supabase
      .from("invoice")
      .update({ payment_link_id: paymentLink.id })
      .eq("id", invoice_id);

    if (invoiceUpdateError) {
      console.error("Error updating invoice:", invoiceUpdateError);
      // Don't fail the request, but log the error
    }

    return jsonResponse({
      success: true,
      payment_link: {
        id: paymentLink.id,
        url: session.url!,
        status: "open",
        expires_at: paymentLink.expires_at,
      },
    });
  } catch (error) {
    console.error("Create payment link error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create payment link",
      500,
    );
  }
});
