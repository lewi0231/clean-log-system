/**
 * P0 Critical Tests: Feedback Email Functionality
 *
 * These tests ensure feedback emails are sent correctly with proper test mode support.
 * Failure here means feedback requests don't reach customers = missed feedback opportunities.
 *
 * Run with: deno test --allow-all --config=deno.json _utils/__tests__/feedback-email.test.ts
 * Or from the database directory: deno test --allow-all supabase/functions/_utils/__tests__/feedback-email.test.ts
 */

import { assertEquals, assertExists } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FeedbackEmailData,
  generateFeedbackToken,
  getFeedbackEmailRecipient,
  sendFeedbackRequestEmail,
} from "../feedback-email.ts";
import type {
  InvoiceEmailRecipientConfig,
  JobContext,
} from "../invoice-email.ts";

// Mock supabase client for Deno tests
const createMockSupabase = () => {
  let mockSingleResponse: { data: unknown; error: unknown } | null = null;

  const mockSelect = () => ({
    eq: () => ({
      single: () =>
        Promise.resolve(mockSingleResponse || { data: null, error: null }),
    }),
  });

  return {
    from: () => ({
      select: mockSelect,
    }),
    _setMockSingleResponse: (response: { data: unknown; error: unknown }) => {
      mockSingleResponse = response;
    },
    _clearMock: () => {
      mockSingleResponse = null;
    },
  } as unknown as SupabaseClient & {
    _setMockSingleResponse: (
      response: { data: unknown; error: unknown },
    ) => void;
    _clearMock: () => void;
  };
};

// Token Generation Tests
Deno.test("P0: should generate unique feedback tokens", () => {
  const token1 = generateFeedbackToken();
  const token2 = generateFeedbackToken();

  assertExists(token1);
  assertExists(token2);
  assertEquals(token1.length > 20, true); // Should be substantial length
  assertEquals(token1 !== token2, true); // Should be unique
});

Deno.test("P0: should generate URL-safe tokens", () => {
  const token = generateFeedbackToken();

  // Should not contain +, /, or = (base64url encoding)
  assertEquals(token.includes("+"), false);
  assertEquals(token.includes("/"), false);
  assertEquals(token.includes("="), false);
});

Deno.test("P0: should generate tokens with sufficient entropy", () => {
  const token = generateFeedbackToken();

  // Base64url encoding of 32 bytes = 43 characters (without padding)
  // Should be at least 40 characters for security
  assertEquals(token.length >= 40, true);
});

// Email Recipient Resolution Tests
Deno.test("P0: should reuse invoice email recipient logic correctly", async () => {
  const mockSupabase = createMockSupabase();
  const jobContext: JobContext = {
    location_id: "loc-123",
    location: {
      id: "loc-123",
      email: "customer@example.com",
      contact_person: "John Doe",
      hierarchy_parent_id: null,
    },
    submission_data: null,
  };

  const config: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: null,
    default_email: null,
  };

  const email = await getFeedbackEmailRecipient(
    mockSupabase,
    jobContext,
    config,
  );

  assertEquals(email, "customer@example.com");
});

Deno.test("P0: should handle hierarchy billing email source", async () => {
  const mockSupabase = createMockSupabase();
  const jobContext: JobContext = {
    location_id: "loc-1",
    location: {
      id: "loc-1",
      email: "location@example.com",
      contact_person: "John Doe",
      hierarchy_parent_id: "hier-1",
    },
    submission_data: null,
  };

  const config: InvoiceEmailRecipientConfig = {
    location_email_source: "hierarchy_billing_email",
    form_field_email: null,
    default_email: null,
  };

  // Set up mock hierarchy response
  (mockSupabase as unknown as {
    _setMockSingleResponse: (
      response: { data: unknown; error: unknown },
    ) => void;
  })._setMockSingleResponse({
    data: {
      id: "hier-1",
      type: "organization",
      metadata: {
        billing_address: {
          email: "billing@company.com",
        },
      },
    },
    error: null,
  });

  const email = await getFeedbackEmailRecipient(
    mockSupabase,
    jobContext,
    config,
  );

  assertEquals(email, "billing@company.com");
  (mockSupabase as unknown as { _clearMock: () => void })._clearMock();
});

Deno.test("P0: should handle form field email source", async () => {
  const mockSupabase = createMockSupabase();
  const jobContext: JobContext = {
    location_id: null,
    location: null,
    submission_data: {
      customer_email: "form@example.com",
    },
  };

  const config: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: "field-config-1",
    default_email: null,
  };

  const fieldConfigMap = new Map([
    [
      "field-config-1",
      {
        name: "customer_email",
      },
    ],
  ]);

  const email = await getFeedbackEmailRecipient(
    mockSupabase,
    jobContext,
    config,
    fieldConfigMap,
  );

  assertEquals(email, "form@example.com");
});

Deno.test("P0: should return null when no email source (default_email deprecated)", async () => {
  const mockSupabase = createMockSupabase();
  const jobContext: JobContext = {
    location_id: null,
    location: null,
    submission_data: null,
  };

  const config: InvoiceEmailRecipientConfig = {
    location_email_source: "location_email",
    form_field_email: null,
    default_email: "default@example.com",
  };

  const email = await getFeedbackEmailRecipient(
    mockSupabase,
    jobContext,
    config,
  );

  // default_email is deprecated and fallback was removed; no source => null
  assertEquals(email, null);
});

// Test Mode Tests
Deno.test("P0: should send to test address when RESEND_TEST_MODE=true", async () => {
  // Set test mode
  const originalTestMode = Deno.env.get("RESEND_TEST_MODE");
  Deno.env.set("RESEND_TEST_MODE", "true");
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const emailData: FeedbackEmailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    jobId: "job-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-123",
    feedbackReviewUrl: "https://test.com/review/test-token-123",
  };

  // Mock fetch to intercept Resend API calls
  const originalFetch = globalThis.fetch;
  let capturedBody: unknown = null;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.includes("api.resend.com")) {
      // Capture the request body
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: "test-email-id-123" }),
          { status: 200 },
        ),
      );
    }
    return originalFetch(input, init);
  };

  try {
    const result = await sendFeedbackRequestEmail(emailData, false);

    assertEquals(result.success, true);
    assertExists(capturedBody);

    // TypeScript assertion: we know capturedBody is not null after assertExists
    const body = capturedBody as {
      to: string[];
      subject: string;
      tags?: Array<{ name: string; value: string }>;
    };

    // Verify email was sent to test address
    assertEquals(
      body.to[0],
      `delivered+feedback-${emailData.jobId}@resend.dev`,
    );
    assertEquals(body.subject.includes("[TEST]"), true);
    assertExists(body.tags);
    assertEquals(body.tags!.length, 3);
    assertEquals(body.tags![0].name, "test-mode");
    assertEquals(body.tags![0].value, "feedback");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTestMode) {
      Deno.env.set("RESEND_TEST_MODE", originalTestMode);
    } else {
      Deno.env.delete("RESEND_TEST_MODE");
    }
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_DOMAIN");
    Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");
    Deno.env.delete("WORKER_INVITATION_BASE_URL");
  }
});

Deno.test("P0: should send to real recipient when RESEND_TEST_MODE=false", async () => {
  // Set test mode to false
  const originalTestMode = Deno.env.get("RESEND_TEST_MODE");
  Deno.env.set("RESEND_TEST_MODE", "false");
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const emailData: FeedbackEmailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    jobId: "job-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-123",
    feedbackReviewUrl: "https://test.com/review/test-token-123",
  };

  // Mock fetch to intercept Resend API calls
  const originalFetch = globalThis.fetch;
  let capturedBody: unknown = null;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.includes("api.resend.com")) {
      // Capture the request body
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: "test-email-id-123" }),
          { status: 200 },
        ),
      );
    }
    return originalFetch(input, init);
  };

  try {
    const result = await sendFeedbackRequestEmail(emailData, false);

    assertEquals(result.success, true);
    assertExists(capturedBody);

    // TypeScript assertion: we know capturedBody is not null after assertExists
    const body = capturedBody as {
      to: string[];
      subject: string;
      tags?: Array<{ name: string; value: string }>;
    };

    // Verify email was sent to real address
    assertEquals(body.to[0], emailData.recipientEmail);
    assertEquals(body.subject.includes("[TEST]"), false);
    // Tags should not be present in production mode
    assertEquals(body.tags, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTestMode) {
      Deno.env.set("RESEND_TEST_MODE", originalTestMode);
    } else {
      Deno.env.delete("RESEND_TEST_MODE");
    }
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_DOMAIN");
    Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");
    Deno.env.delete("WORKER_INVITATION_BASE_URL");
  }
});

Deno.test("P0: should send to real recipient when RESEND_TEST_MODE unset", async () => {
  // Ensure test mode is not set
  const originalTestMode = Deno.env.get("RESEND_TEST_MODE");
  Deno.env.delete("RESEND_TEST_MODE");
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const emailData: FeedbackEmailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    jobId: "job-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-123",
    feedbackReviewUrl: "https://test.com/review/test-token-123",
  };

  // Mock fetch to intercept Resend API calls
  const originalFetch = globalThis.fetch;
  let capturedBody: unknown = null;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.includes("api.resend.com")) {
      // Capture the request body
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: "test-email-id-123" }),
          { status: 200 },
        ),
      );
    }
    return originalFetch(input, init);
  };

  try {
    const result = await sendFeedbackRequestEmail(emailData, false);

    assertEquals(result.success, true);
    assertExists(capturedBody);

    // TypeScript assertion: we know capturedBody is not null after assertExists
    const body = capturedBody as {
      to: string[];
      subject: string;
      tags?: Array<{ name: string; value: string }>;
    };

    // Verify email was sent to real address
    assertEquals(body.to[0], emailData.recipientEmail);
    assertEquals(body.subject.includes("[TEST]"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTestMode) {
      Deno.env.set("RESEND_TEST_MODE", originalTestMode);
    }
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_DOMAIN");
    Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");
    Deno.env.delete("WORKER_INVITATION_BASE_URL");
  }
});

// Email Sending Tests
Deno.test("P0: should handle missing FEEDBACK_REVIEW_BASE_URL gracefully", async () => {
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");
  Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");

  const emailData: FeedbackEmailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    jobId: "job-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-123",
    feedbackReviewUrl: "https://test.com/review/test-token-123",
  };

  const result = await sendFeedbackRequestEmail(emailData, false);

  assertEquals(result.success, false);
  assertEquals(
    result.error?.includes("FEEDBACK_REVIEW_BASE_URL"),
    true,
  );

  Deno.env.delete("RESEND_API_KEY");
  Deno.env.delete("RESEND_FROM_DOMAIN");
});

Deno.test("P0: should handle Resend API errors gracefully", async () => {
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const emailData: FeedbackEmailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    jobId: "job-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-123",
    feedbackReviewUrl: "https://test.com/review/test-token-123",
  };

  // Mock fetch to return error
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL) => {
    if (typeof input === "string" && input.includes("api.resend.com")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ message: "Invalid API key" }),
          { status: 401 },
        ),
      );
    }
    return originalFetch(input);
  };

  try {
    const result = await sendFeedbackRequestEmail(emailData, false);

    assertEquals(result.success, false);
    assertExists(result.error);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_DOMAIN");
    Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");
    Deno.env.delete("WORKER_INVITATION_BASE_URL");
  }
});

Deno.test("P0: should return email ID on successful send", async () => {
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const emailData: FeedbackEmailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    jobId: "job-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-123",
    feedbackReviewUrl: "https://test.com/review/test-token-123",
  };

  // Mock fetch to return success
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL) => {
    if (typeof input === "string" && input.includes("api.resend.com")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: "resend-email-id-456" }),
          { status: 200 },
        ),
      );
    }
    return originalFetch(input);
  };

  try {
    const result = await sendFeedbackRequestEmail(emailData, false);

    assertEquals(result.success, true);
    assertEquals(result.emailId, "resend-email-id-456");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_DOMAIN");
    Deno.env.delete("FEEDBACK_REVIEW_BASE_URL");
    Deno.env.delete("WORKER_INVITATION_BASE_URL");
  }
});
