# GitHub Issue: Email Verification and OAuth Authentication

## Summary

Implement email verification for new user signups and add OAuth authentication (Google) to improve security and user experience.

## Current State

- **Authentication**: Password-only authentication
- **Email Verification**: Auto-confirmed (`email_confirm: true`) in `register-organization` function
- **OAuth Providers**: None configured
- **User Flow**: Users are immediately signed in after registration without email verification

## Research Findings

### Email Verification Best Practices

Based on industry research, the **hybrid approach** is the most recommended for SaaS applications:

1. **Allow immediate signup** - Users can create accounts and access basic features
2. **Prompt verification later** - Send verification email and show reminders
3. **Restrict access until verified** - Limit certain features (e.g., full dashboard access, invoice sending) until email is verified
4. **Benefits**:
   - Better conversion rates (users don't abandon during signup)
   - Improved security (validates email ownership)
   - Reduces spam/fake accounts
   - Better deliverability (verified emails are more trusted)

### OAuth Implementation Timing

**Recommendation: Implement closer to deployment**

**Reasons to defer:**

- OAuth requires production URLs for callbacks (difficult to test locally)
- Requires OAuth app setup with providers (Google Cloud Console)
- Testing OAuth flows is complex in development environments
- Can be added as a "nice-to-have" feature post-MVP

**Reasons to implement early:**

- Improves user experience (faster signup)
- Reduces password-related support issues
- Industry standard for modern SaaS applications

**Compromise**: Implement email verification now (critical for security), defer OAuth until closer to production deployment.

### OAuth Provider Priority

1. **Google** - Most common, widely used, easy integration with Supabase
2. **Microsoft** - Important for B2B customers
3. **Apple** - Important for mobile apps (if needed)

**Initial Recommendation**: Start with Google OAuth only.

## Implementation Plan

### Phase 1: Email Verification (Priority: High)

1. **Update Supabase Auth Configuration**

   - Disable auto-confirmation (`email_confirm: false`)
   - Configure email templates for verification
   - Set up SMTP (or use Supabase's email service)

2. **Update Registration Flow**

   - Remove `email_confirm: true` from `register-organization` function
   - Send verification email after account creation
   - Don't auto-sign-in after registration

3. **Update Frontend**

   - Show "Check your email" message after signup
   - Add email verification status check
   - Implement verification reminder UI
   - Restrict access to certain features until verified

4. **Email Verification Status**
   - Check `user.email_confirmed_at` in middleware
   - Redirect unverified users to verification page
   - Allow access to basic features but restrict sensitive operations

### Phase 2: OAuth Authentication (Priority: Medium - Defer to Pre-Production)

1. **Google OAuth Setup**

   - Create OAuth app in Google Cloud Console
   - Configure redirect URIs (production URLs)
   - Add OAuth credentials to Supabase dashboard

2. **Supabase Configuration**

   - Enable Google provider in Supabase Auth settings
   - Configure OAuth redirect URLs

3. **Frontend Implementation**

   - Add "Sign in with Google" button to login/signup pages
   - Handle OAuth callback flow
   - Link OAuth accounts to existing organizations (if applicable)

4. **Testing**
   - Test OAuth flow in production/staging environment
   - Test account linking scenarios
   - Verify mobile app OAuth support (if needed)

## Technical Details

### Files to Modify

**Email Verification:**

- `database/supabase/functions/register-organization/index.ts` - Remove auto-confirmation
- `dashboard/app/signup/page.tsx` - Update signup flow
- `dashboard/middleware.ts` - Add email verification check
- `database/supabase/config.toml` - Configure email settings

**OAuth (Future):**

- `dashboard/app/login/page.tsx` - Add OAuth buttons
- `dashboard/app/signup/page.tsx` - Add OAuth signup option
- `mobile-app/app/login.tsx` - Add OAuth support (if needed)
- Supabase dashboard configuration

### Supabase Email Configuration

```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true
```

### Email Verification Flow

1. User signs up → Account created but email not confirmed
2. Verification email sent automatically
3. User clicks link → Email confirmed
4. User can now access full features

### OAuth Flow (Future)

1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent screen
3. User authorizes → Redirected back to app
4. Supabase creates/links account
5. User signed in

## Testing Considerations

### Email Verification Testing

- Test verification email delivery
- Test verification link expiration
- Test resend verification email
- Test restricted access for unverified users
- Test verification reminder UI

### OAuth Testing (Future)

- Test OAuth flow in production environment
- Test account creation via OAuth
- Test linking OAuth to existing accounts
- Test error handling (user cancels, network errors)

## Acceptance Criteria

### Email Verification

- [ ] New users receive verification email after signup
- [ ] Users cannot access sensitive features until verified
- [ ] Verification email contains clear instructions
- [ ] Users can resend verification email
- [ ] Unverified users see clear status and reminders
- [ ] Verification link expires after reasonable time (24-48 hours)

### OAuth (Future)

- [ ] Google OAuth button appears on login/signup pages
- [ ] OAuth flow completes successfully
- [ ] New accounts created via OAuth work correctly
- [ ] Existing users can link OAuth accounts
- [ ] OAuth works on both dashboard and mobile app (if applicable)

## Related Issues

- Manual testing scenarios document
- Security improvements needed before production

## Notes

- Email verification is **critical** for security and should be implemented before production
- OAuth is a **nice-to-have** that improves UX but can be deferred
- Consider implementing email verification now, OAuth closer to deployment
- Both features require Supabase configuration changes
- OAuth requires production URLs, making local testing difficult

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)
