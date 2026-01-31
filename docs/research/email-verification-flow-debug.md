# Email Verification Flow - Logic Explanation & Debugging

## How Email Verification Should Work

### 1. User Signs Up

- User fills out signup form
- Frontend calls `register-organization` edge function
- Edge function:
  - Creates organization in database
  - Creates user with `email_confirm: false` (requires verification)
  - Generates verification link using `admin.generateLink()` with type "signup"
  - Sends email via Resend with the verification link
- Frontend redirects to `/verify-email?email=...`

### 2. Email Link Format

When `admin.generateLink()` is called with:

```typescript
{
  type: "signup",
  email: admin_email,
  password: password,
  options: {
    redirectTo: `${siteUrl}/verify-email?email=${encodeURIComponent(admin_email)}`
  }
}
```

Supabase generates a link that:

- Points to Supabase's auth endpoint (e.g., `https://your-project.supabase.co/auth/v1/verify`)
- Contains verification tokens
- Redirects to our `redirectTo` URL after verification

### 3. User Clicks Email Link

When the user clicks the link:

- Supabase's auth endpoint verifies the email
- Sets `email_confirmed_at` on the user
- Creates a session
- Redirects to our redirect URL with tokens in the hash:
  ```
  /verify-email?email=user@example.com#access_token=...&type=email&token_hash=...
  ```

### 4. Verification Page Handles Redirect

The verification page (`/verify-email/page.tsx`) should:

1. Extract tokens from URL hash/params
2. If `token_hash` and `type=email` exist, call `verifyOtp()` to complete verification
3. If `access_token` exists, session is already established - just check status
4. Check session/user for `email_confirmed_at`
5. Show success message if verified
6. Redirect to onboarding

## Potential Issues

### Issue 1: URL Format Mismatch

**Problem**: Supabase might redirect with a different URL format than expected.

**Debug**: Check the browser console logs for:

- `VerifyEmail: Checking verification status` - shows full URL
- `VerifyEmail: Extracted tokens` - shows what tokens were found

**Solution**: The code now checks both hash (`#token_hash=...`) and query params (`?token_hash=...`)

### Issue 2: Session Not Established

**Problem**: When clicking the email link, the session might not be established yet when we check.

**Debug**: Check logs for:

- `VerifyEmail: Verification status check` - shows if session exists
- `hasSession`, `hasUser`, `emailConfirmed` values

**Solution**: Code now waits 500ms after verification before checking session

### Issue 3: Token Already Used

**Problem**: The verification token might have already been used when Supabase redirects.

**Debug**: Check for error: "Token has expired or is invalid"

**Solution**: If token is already used, Supabase should have already verified the email, so we just need to check the session/user status

### Issue 4: Middleware Interference

**Problem**: Middleware might be redirecting before the verification page can process tokens.

**Current Middleware Behavior**:

- `/verify-email` is in the public routes list ✅
- Middleware doesn't redirect for `/verify-email` ✅
- However, middleware does check session, which might interfere

**Potential Issue**: If middleware runs before client-side code processes the hash, it might not see the session yet.

### Issue 5: Hash Not Available in Server-Side Context

**Problem**: URL hash (`#...`) is NOT sent to the server. It's only available client-side.

**This is important**: The middleware runs server-side and CANNOT see the hash. This is correct behavior.

**Solution**: Client-side code must handle hash processing (which it does)

## Current Debugging Added

The code now logs:

1. Full URL when page loads
2. Hash and search params extracted
3. Token detection results
4. Verification attempt results
5. Session/user status after verification

## Next Steps for Debugging

1. **Check Browser Console**: Look for the debug logs when clicking the email link
2. **Check Network Tab**: See what requests are being made to Supabase
3. **Check URL**: What does the actual URL look like when redirected from email?
4. **Check Supabase Logs**: Are there any errors in Supabase dashboard?

## Quick Test

To test if verification is working:

1. Click the email verification link
2. Open browser console (F12)
3. Look for logs starting with "VerifyEmail:"
4. Share the logs - they'll show exactly what's happening
