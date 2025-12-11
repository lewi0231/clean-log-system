# Feedback Request Email Implementation Recommendations

## Executive Summary

This document outlines a comprehensive approach to implementing automatic feedback request emails that are sent immediately after job completion. The implementation will reuse the proven invoice email recipient selection logic and follow industry best practices for review request emails.

## Current State Analysis

### ✅ What's Already in Place

1. **Settings Infrastructure:**

   - `feedback_email_send_immediately` boolean setting exists in `organization` table
   - Settings UI toggle is already implemented in `dashboard/app/dashboard/settings/page.tsx`
   - Setting can be updated via `update-organization-settings` edge function

2. **Email Recipient Logic:**

   - Well-defined email recipient selection logic in `database/supabase/functions/_utils/invoice-email.ts`
   - Supports multiple email sources: location email, hierarchy billing email, form field email, default email
   - Email validation and precedence logic already tested and working

3. **Email Infrastructure:**

   - Resend API integration in `database/supabase/functions/_utils/email.ts`
   - Email configuration validation
   - Template-based email sending (worker invitations, invoices)

4. **Database Schema:**
   - `job` table exists with `completed_at` timestamp
   - `feedback` table exists for storing ratings/comments
   - Job-worker relationships via `job_worker` table

### ❌ What's Missing

1. **Feedback Token Generation:**

   - No automatic generation of `feedback_token` when jobs are created
   - No unique token per job for secure feedback submission

2. **Email Sending Logic:**

   - No automatic email sending when jobs are completed
   - No integration with `feedback_email_send_immediately` setting
   - No feedback request email template

3. **Email Recipient Configuration:**

   - No separate configuration for feedback emails (should reuse invoice config or have its own)
   - Need to determine if feedback emails should use same recipient logic as invoices

4. **Tracking:**
   - No tracking of whether feedback email was sent
   - No `feedback_email_sent` or `feedback_email_sent_at` fields on job table

## Research-Based Best Practices

Based on industry research, effective review request emails should:

1. **Timing:** Send immediately after service completion (✅ we have this setting)
2. **Personalization:** Include customer name and reference specific service/job
3. **Simplicity:** Make it easy to leave a review with a single click
4. **Value Proposition:** Explain why their feedback matters
5. **Mobile-Friendly:** Ensure email and review form work on mobile devices
6. **Follow-up:** Consider gentle reminders if no response after 3-7 days (future enhancement)

## Recommended Architecture

### Option 1: Reuse Invoice Email Recipient Config (Recommended)

**Pros:**

- Single source of truth for email configuration
- Consistent behavior between invoices and feedback
- Less configuration complexity for users
- Simpler implementation

**Cons:**

- Feedback and invoices always go to same recipient
- May not be ideal if different contacts should receive feedback vs invoices

**Recommendation:** Start with this approach, add separate config later if needed.

### Option 2: Separate Feedback Email Recipient Config

**Pros:**

- Flexibility to send feedback to different contacts than invoices
- Can have different fallback logic

**Cons:**

- More configuration complexity
- More code to maintain
- May confuse users

**Recommendation:** Implement Option 1 first, add Option 2 as enhancement if users request it.

## Implementation Plan

### Phase 1: Database Schema Updates

1. **Add feedback email tracking fields to `job` table:**

   ```sql
   ALTER TABLE job
     ADD COLUMN IF NOT EXISTS feedback_token TEXT UNIQUE,
     ADD COLUMN IF NOT EXISTS feedback_email_sent BOOLEAN DEFAULT false,
     ADD COLUMN IF NOT EXISTS feedback_email_sent_at TIMESTAMPTZ;

   CREATE INDEX IF NOT EXISTS idx_job_feedback_token ON job(feedback_token);
   ```

2. **Add feedback review URL environment variable:**
   - `FEEDBACK_REVIEW_BASE_URL` - Base URL for feedback review page (e.g., `https://yourdomain.com/review`)

### Phase 2: Utility Functions

1. **Create `database/supabase/functions/_utils/feedback-email.ts`:**

   - `generateFeedbackToken()` - Generate secure unique token
   - `getFeedbackEmailRecipient()` - Reuse invoice email logic
   - `sendFeedbackRequestEmail()` - Send email with review link
   - `FeedbackEmailData` interface

2. **Reuse existing utilities:**
   - `getInvoiceEmailRecipient()` from `invoice-email.ts`
   - Email validation from `invoice-email.ts`
   - Email config validation from `email.ts`

### Phase 3: Email Template

Create a professional, mobile-friendly feedback request email template that includes:

- **Subject:** "How was your service? We'd love your feedback!"
- **Personalization:** Customer name, service date, location name
- **Clear CTA:** Single prominent button to leave review
- **Value Proposition:** Brief explanation of why feedback matters
- **Branding:** Organization name and logo (if available)

### Phase 4: Integration Points

1. **Update `create-job` edge function:**

   - After job creation, check `feedback_email_send_immediately` setting
   - If enabled:
     - Generate feedback token
     - Determine email recipient using invoice email logic
     - Send feedback request email
     - Update job with token and email tracking

2. **Update `admin-create-job` edge function:**

   - Same logic as `create-job`

3. **Error Handling:**
   - If email send fails, log error but don't fail job creation
   - Job should be created successfully even if email fails
   - Consider retry mechanism for failed emails (future enhancement)

### Phase 5: Feedback Review Page

1. **Create public feedback review page:**

   - Route: `/review/[token]`
   - Validate token and fetch job details
   - Display job information (location, date, workers)
   - Rating form (1-5 stars)
   - Comment field (optional)
   - Submit feedback

2. **Update feedback submission:**
   - Use token to identify job
   - Ensure feedback can only be submitted once per job
   - Store feedback in `feedback` table

## Detailed Implementation Steps

### Step 1: Database Migration

```sql
-- Add feedback email tracking columns
ALTER TABLE job
  ADD COLUMN IF NOT EXISTS feedback_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS feedback_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_email_sent_at TIMESTAMPTZ;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_job_feedback_token ON job(feedback_token);

-- Add comments
COMMENT ON COLUMN job.feedback_token IS 'Unique token for secure feedback submission via public URL';
COMMENT ON COLUMN job.feedback_email_sent IS 'Whether feedback request email was sent for this job';
COMMENT ON COLUMN job.feedback_email_sent_at IS 'Timestamp when feedback request email was sent';
```

### Step 2: Create Feedback Email Utility

Create `database/supabase/functions/_utils/feedback-email.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { crypto } from "crypto";
import {
  getInvoiceEmailRecipient,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "./invoice-email.ts";
import { sendEmail, validateEmailConfig, type EmailConfig } from "./email.ts";

export interface FeedbackEmailData {
  recipientEmail: string;
  recipientName: string | null;
  organizationName: string;
  jobId: string;
  jobCompletedAt: string;
  locationName: string | null;
  feedbackToken: string;
  feedbackReviewUrl: string;
}

/**
 * Generate a secure, unique feedback token
 */
export function generateFeedbackToken(): string {
  // Generate 32 random bytes and convert to base64url
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...randomBytes));
  // Convert to base64url (URL-safe)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Get feedback email recipient using invoice email recipient logic
 */
export async function getFeedbackEmailRecipient(
  supabase: SupabaseClient,
  job: JobContext,
  config: InvoiceEmailRecipientConfig,
  fieldConfigMap?: Map<string, { name: string }>
): Promise<string | null> {
  // Reuse invoice email recipient logic
  return await getInvoiceEmailRecipient(supabase, job, config, fieldConfigMap);
}

/**
 * Send feedback request email
 */
export async function sendFeedbackRequestEmail(
  data: FeedbackEmailData,
  throwOnError = false
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  // Validate email config
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email service not configured";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  const config = configResult.config;
  const feedbackReviewBaseUrl = Deno.env.get("FEEDBACK_REVIEW_BASE_URL");

  if (!feedbackReviewBaseUrl) {
    const error = "FEEDBACK_REVIEW_BASE_URL environment variable not set";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Build review URL
  const reviewUrl = `${feedbackReviewBaseUrl.replace(/\/$/, "")}/review/${
    data.feedbackToken
  }`;

  // Format recipient name
  const recipientName = data.recipientName || "Valued Customer";

  // Format job date
  const jobDate = new Date(data.jobCompletedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build email HTML
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>We'd Love Your Feedback</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #1a1a1a; margin-top: 0;">Hi ${recipientName},</h1>
        
        <p style="font-size: 16px; color: #666;">
          Thank you for choosing ${
            data.organizationName
          } for your recent service${
    data.locationName ? ` at ${data.locationName}` : ""
  } on ${jobDate}.
        </p>
        
        <p style="font-size: 16px; color: #666;">
          We'd love to hear about your experience! Your feedback helps us improve our services and ensures we continue to meet your expectations.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${reviewUrl}" 
             style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Leave Your Review
          </a>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 40px;">
          This review will only take a minute, and your feedback is greatly appreciated.
        </p>
        
        <p style="font-size: 14px; color: #999; margin-top: 20px;">
          If you have any questions or concerns, please don't hesitate to reach out to us directly.
        </p>
        
        <p style="font-size: 14px; color: #999; margin-top: 40px;">
          Best regards,<br>
          The ${data.organizationName} Team
        </p>
      </div>
    </body>
    </html>
  `;

  // Build email text version
  const emailText = `
Hi ${recipientName},

Thank you for choosing ${data.organizationName} for your recent service${
    data.locationName ? ` at ${data.locationName}` : ""
  } on ${jobDate}.

We'd love to hear about your experience! Your feedback helps us improve our services and ensures we continue to meet your expectations.

Please leave your review here: ${reviewUrl}

This review will only take a minute, and your feedback is greatly appreciated.

If you have any questions or concerns, please don't hesitate to reach out to us directly.

Best regards,
The ${data.organizationName} Team
  `.trim();

  // Send email via Resend
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: `noreply@${config.resendFromDomain}`,
        to: [data.recipientEmail],
        subject: `How was your service? We'd love your feedback!`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      const errorMessage =
        (errorBody &&
          typeof errorBody === "object" &&
          "message" in errorBody &&
          typeof errorBody.message === "string" &&
          errorBody.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send feedback email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      console.log("Feedback email sent successfully:", emailId);
      return { success: true, emailId };
    } else {
      console.warn("Resend response missing ID:", emailResponse);
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    console.error("Failed to send feedback email:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    return { success: false, error: errorMsg };
  }
}
```

### Step 3: Update Job Creation Functions

Both `create-job` and `admin-create-job` should:

1. Create job as normal
2. After successful job creation:
   - Fetch organization settings to check `feedback_email_send_immediately`
   - If enabled:
     - Generate feedback token
     - Fetch invoice email recipient config
     - Get email recipient using `getFeedbackEmailRecipient()`
     - If recipient found:
       - Send feedback email
       - Update job with token and email tracking
     - If no recipient found:
       - Log warning but don't fail
       - Still generate token for manual sending later

### Step 4: Create Feedback Review Page

Create a public Next.js page at `dashboard/app/review/[token]/page.tsx`:

- Validate token
- Fetch job details
- Display job information
- Rating form
- Submit feedback

## Configuration Considerations

### Email Recipient Configuration

**Recommendation:** Initially reuse `invoice_template_config.email_recipient_config` for feedback emails. This provides:

- Consistent behavior
- Single configuration point
- Proven logic

**Future Enhancement:** If users need different recipients for feedback vs invoices, add `feedback_email_recipient_config` to `organization_settings` or create separate config table.

### Environment Variables

Required:

- `FEEDBACK_REVIEW_BASE_URL` - Base URL for feedback review page (e.g., `https://yourdomain.com`)

Already configured:

- `RESEND_API_KEY`
- `RESEND_FROM_DOMAIN`

## Error Handling Strategy

1. **Job Creation:** Should always succeed even if email fails
2. **Email Failures:** Log errors but don't block job creation
3. **Missing Recipients:** Log warning, generate token anyway (can send manually later)
4. **Token Generation:** Use database constraints to ensure uniqueness, handle collisions

## Testing Strategy

1. **Unit Tests:**

   - Token generation uniqueness
   - Email recipient selection logic
   - Email template rendering

2. **Integration Tests:**

   - Job creation with email sending enabled
   - Job creation with email sending disabled
   - Email sending with various recipient configurations
   - Feedback submission via token

3. **Manual Testing:**
   - Test email delivery
   - Test email rendering on various clients
   - Test mobile responsiveness
   - Test feedback submission flow

## Future Enhancements

1. **Reminder Emails:** Send follow-up if no feedback after 3-7 days
2. **Separate Recipient Config:** Allow different recipients for feedback vs invoices
3. **Email Templates:** Allow organizations to customize email template
4. **Analytics:** Track email open rates, click-through rates, feedback submission rates
5. **Batch Processing:** Process multiple jobs in background job queue
6. **Retry Logic:** Automatic retry for failed email sends

## Security Considerations

1. **Token Security:**

   - Use cryptographically secure random token generation
   - Tokens should be long enough to prevent brute force (32 bytes = 256 bits)
   - Tokens should be unique (database constraint)
   - Tokens should expire after reasonable time (e.g., 90 days) - future enhancement

2. **Rate Limiting:**

   - Limit feedback submissions per token (already enforced by UNIQUE constraint on feedback.job_id)
   - Consider rate limiting on review page

3. **Email Validation:**
   - Validate email addresses before sending
   - Handle bounces and invalid addresses gracefully

## Success Metrics

Track:

- Percentage of jobs with feedback emails sent
- Email delivery success rate
- Feedback submission rate (emails sent → feedback received)
- Average time from email send to feedback submission
- Feedback quality (ratings distribution, comment length)

## Test Mode Configuration

### Resend Test Mode

The system supports Resend's test mode for safe email testing without sending emails to real recipients.

#### Environment Variable

Set `RESEND_TEST_MODE=true` in your Supabase project environment variables to enable test mode.

#### Test Mode Behavior

When `RESEND_TEST_MODE=true`:

- **All emails are redirected** to Resend test addresses:
  - Feedback emails: `delivered+feedback-{jobId}@resend.dev`
  - Invoice emails: `delivered+invoice-{invoiceNumber}@resend.dev`
  - Worker invitations: `delivered+invitation-{token}@resend.dev`
- **Email subjects are prefixed** with `[TEST]` for easy identification
- **Resend tags are added** for tracking:
  - `test-mode`: Email type (feedback, invoice, invitation)
  - `identifier`: Job ID, invoice number, or invitation token
  - `original-recipient`: The original recipient email address
- **Enhanced logging** includes test mode indicators and original recipients

#### Test Addresses

Resend provides several test addresses for different scenarios:

- `delivered@resend.dev` - Simulates successful delivery (default for test mode)
- `bounced@resend.dev` - Simulates bounced email
- `complained@resend.dev` - Simulates spam complaint

Labels can be added after the `+` symbol (e.g., `delivered+feedback-123@resend.dev`) for tracking.

#### Usage

**For Testing:**

```bash
# Set in Supabase project settings
RESEND_TEST_MODE=true
```

**For Production:**

```bash
# Set to false or don't set at all
RESEND_TEST_MODE=false
# or simply omit the variable
```

#### Running Tests

**Unit Tests:**

```bash
deno test --allow-all database/supabase/functions/_utils/__tests__/feedback-email.test.ts
```

**Integration Tests:**

```bash
deno test --allow-all database/supabase/functions/__tests__/feedback-email-integration.test.ts
```

**All Feedback Email Tests:**

```bash
deno test --allow-all --filter "feedback"
```

#### Test Coverage

The test suite covers:

- Token generation (uniqueness, URL-safety, entropy)
- Email recipient resolution (all precedence scenarios)
- Test mode detection and redirection
- Email sending (success, errors, test mode)
- Integration with job creation flow
- Error handling and graceful degradation

#### Manual Testing Checklist

1. Set `RESEND_TEST_MODE=true` in Supabase environment
2. Create a job with `feedback_email_send_immediately=true`
3. Verify email goes to test address (`delivered+feedback-{jobId}@resend.dev`)
4. Check email subject includes `[TEST]` prefix
5. Verify tags in Resend dashboard
6. Check logs for test mode indicators
7. Verify original recipient is logged correctly
8. Test with `RESEND_TEST_MODE=false` to verify production behavior

## Conclusion

This implementation provides a robust, scalable solution for automatic feedback request emails that:

- ✅ Reuses proven invoice email recipient logic
- ✅ Follows industry best practices
- ✅ Handles errors gracefully
- ✅ Provides good user experience
- ✅ Is maintainable and extensible
- ✅ Includes comprehensive test mode support for safe testing

The phased approach allows for incremental implementation and testing, reducing risk and allowing for adjustments based on user feedback.
