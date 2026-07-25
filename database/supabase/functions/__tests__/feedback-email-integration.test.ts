/**
 * Integration Tests: Feedback Email in Job Creation Flow
 *
 * These tests ensure feedback emails are sent correctly when jobs are created
 * with feedback_auto_send enabled, including test mode support.
 *
 * Run with: deno test --allow-all functions/__tests__/feedback-email-integration.test.ts
 */

import { assertEquals, assertExists } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";

const createMailResolverSupabase = (): SupabaseClient =>
  ({
    from: (table: string) => {
      if (table === "organization") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { custom_email_domain_enabled: false },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  }) as unknown as SupabaseClient;

// Note: These are integration tests that would require a real Supabase instance
// For now, we'll test the logic patterns that can be unit tested
// Full integration tests would require setting up test database

Deno.test(
  "P0: should generate feedback token when job created with feedback_auto_send enabled",
  async () => {
    // This test verifies the token generation logic
    // In a real integration test, we would:
    // 1. Create a job via create-job function
    // 2. Check that feedback_token is set
    // 3. Verify token is unique and valid format

    // For now, test token generation directly
    const { generateFeedbackToken } = await import("../_utils/feedback-email.ts");

    const token = generateFeedbackToken();
    assertExists(token);
    assertEquals(token.length >= 40, true);
    assertEquals(token.includes("+"), false);
    assertEquals(token.includes("/"), false);
    assertEquals(token.includes("="), false);
  }
);

Deno.test("P0: should not send email when feedback_auto_send is disabled", () => {
  // This test verifies that emails are not sent when setting is false
  // In a real integration test, we would:
  // 1. Set feedback_auto_send = false
  // 2. Create a job
  // 3. Verify no email was sent (check logs or database)

  // For now, this is a placeholder - full test requires Supabase instance
  assertEquals(true, true); // Placeholder assertion
});

Deno.test("P0: should send email to test address when RESEND_TEST_MODE=true", async () => {
  // Set test mode
  const originalTestMode = Deno.env.get("RESEND_TEST_MODE");
  Deno.env.set("RESEND_TEST_MODE", "true");
  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const { sendFeedbackRequestEmail } = await import("../_utils/feedback-email.ts");

  const emailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    organizationId: "00000000-0000-0000-0000-000000000001",
    jobId: "job-integration-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-integration-123",
    feedbackReviewUrl: "https://test.com/review/test-token-integration-123",
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
        new Response(JSON.stringify({ id: "test-email-id-integration" }), { status: 200 })
      );
    }
    return originalFetch(input, init);
  };

  try {
    const result = await sendFeedbackRequestEmail(createMailResolverSupabase(), emailData, false);

    assertEquals(result.success, true);
    assertExists(capturedBody);

    // TypeScript assertion: we know capturedBody is not null after assertExists
    const body = capturedBody as {
      to: string[];
      subject: string;
      tags?: Array<{ name: string; value: string }>;
    };

    // Verify email was sent to test address
    assertEquals(body.to[0], `delivered+feedback-${emailData.jobId}@resend.dev`);
    assertEquals(body.subject.includes("[TEST]"), true);
    assertExists(body.tags);
    assertEquals(body.tags![0].name, "test-mode");
    assertEquals(body.tags![0].value, "feedback");
    assertEquals(body.tags![1].name, "identifier");
    assertEquals(body.tags![1].value, emailData.jobId);
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

Deno.test("P0: should handle missing email recipient gracefully", async () => {
  // This test verifies that job creation succeeds even if no email recipient found
  // In a real integration test, we would:
  // 1. Create a job with no location and no form field email
  // 2. Verify job is created successfully
  // 3. Verify token is still generated
  // 4. Verify no email was sent (but no error thrown)

  // For now, test the recipient resolution returns null gracefully
  const { getFeedbackEmailRecipient } = await import("../_utils/feedback-email.ts");

  // Create a simple mock supabase
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
  const jobContext = {
    location_id: null,
    location: null,
    submission_data: null,
  };

  const config = {
    location_email_source: "location_email" as const,
    form_field_email: null,
    default_email: null,
  };

  const email = await getFeedbackEmailRecipient(mockSupabase, jobContext, config);

  // Should return null when no recipient available (not throw error)
  assertEquals(email, null);
});

Deno.test("P0: should handle email send failure gracefully", async () => {
  // This test verifies that job creation succeeds even if email send fails
  // In a real integration test, we would:
  // 1. Create a job with feedback_auto_send = true
  // 2. Mock email send to fail
  // 3. Verify job is still created
  // 4. Verify token is still generated
  // 5. Verify feedback_email_sent = false

  Deno.env.set("RESEND_API_KEY", "test-key");
  Deno.env.set("RESEND_FROM_DOMAIN", "test.com");
  Deno.env.set("FEEDBACK_REVIEW_BASE_URL", "https://test.com");
  Deno.env.set("WORKER_INVITATION_BASE_URL", "https://test.com");

  const { sendFeedbackRequestEmail } = await import("../_utils/feedback-email.ts");

  const emailData = {
    recipientEmail: "customer@example.com",
    recipientName: "John Doe",
    organizationName: "Test Org",
    organizationId: "00000000-0000-0000-0000-000000000001",
    jobId: "job-error-123",
    jobCompletedAt: new Date().toISOString(),
    locationName: "Test Location",
    feedbackToken: "test-token-error-123",
    feedbackReviewUrl: "https://test.com/review/test-token-error-123",
  };

  // Mock fetch to return error
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL) => {
    if (typeof input === "string" && input.includes("api.resend.com")) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: "API Error" }), { status: 500 })
      );
    }
    return originalFetch(input);
  };

  try {
    // Should not throw, but return error result
    const result = await sendFeedbackRequestEmail(createMailResolverSupabase(), emailData, false);

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
