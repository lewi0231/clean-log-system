import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createStripeClient } from "../_utils/stripe.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  createPaymentLinkSchema,
  validateRequest,
} from "../_utils/zod-schemas.ts";

serve(async (req) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "create-payment-link" });

  try {
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(createPaymentLinkSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for payment link creation", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const body = validation.data;
    const { invoice_id, organization_id, success_url, cancel_url } = body as {
      invoice_id: string;
      organization_id: string;
      success_url?: string;
      cancel_url?: string;
    };

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

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
      // Stripe Checkout Sessions max expiry is 24 hours
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
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
      logger.error("Error creating payment link", linkInsertError, {
        invoice_id,
        organization_id,
      });
      throw linkInsertError;
    }

    // Update invoice with payment link reference
    const { error: invoiceUpdateError } = await supabase
      .from("invoice")
      .update({ payment_link_id: paymentLink.id })
      .eq("id", invoice_id);

    if (invoiceUpdateError) {
      logger.warn("Error updating invoice with payment link", {
        invoice_id,
        payment_link_id: paymentLink.id,
        error: invoiceUpdateError,
      });
      // Don't fail the request, but log the error
    }

    logger.info("Payment link created successfully", {
      invoice_id,
      organization_id,
      payment_link_id: paymentLink.id,
    });

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
    logger.error("Create payment link error", error);
    const errorMessage = extractErrorMessage(
      error,
      "Failed to create payment link",
    );
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
