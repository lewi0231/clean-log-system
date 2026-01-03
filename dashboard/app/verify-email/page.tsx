"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Loading fallback for Suspense
function VerifyEmailLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <CardTitle>Loading...</CardTitle>
          <CardDescription>
            Please wait while we load your verification status.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// Main content component that uses useSearchParams
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  // Check verification status on mount and periodically
  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        // Log the full URL for debugging
        const fullUrl = window.location.href;
        const hash = window.location.hash;
        log.debug("VerifyEmail: Checking verification status", {
          fullUrl,
          hash,
          pathname: window.location.pathname,
          search: window.location.search,
        });

        // Check if there's a verification token in the URL hash (from email link)
        // Supabase email verification links can come in different formats:
        // 1. Hash format: #access_token=...&type=email&token_hash=...
        // 2. Query params: ?token_hash=...&type=email
        const hashParams = new URLSearchParams(hash.substring(1)); // Remove the #
        const searchParams = new URLSearchParams(window.location.search);

        // Try both hash and query params
        const tokenHash =
          hashParams.get("token_hash") || searchParams.get("token_hash");
        const type = hashParams.get("type") || searchParams.get("type");
        const accessToken = hashParams.get("access_token");

        log.debug("VerifyEmail: Extracted tokens", {
          hasTokenHash: !!tokenHash,
          type,
          hasAccessToken: !!accessToken,
        });

        // If we have verification tokens in the URL, verify them
        if (tokenHash && type === "email") {
          log.debug(
            "VerifyEmail: Found verification tokens in URL, verifying",
            {
              type,
              hasTokenHash: !!tokenHash,
            }
          );

          try {
            // Verify the OTP token from the email link
            const { data: verifyData, error: verifyError } =
              await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: "email",
              });

            if (verifyError) {
              log.error("VerifyEmail: Error verifying token", {
                error: verifyError.message,
                code: verifyError.status,
              });
              setResendError(
                `Verification failed: ${verifyError.message}. Please try resending the email.`
              );
              setIsChecking(false);
              // Clear the hash/params so user can try again
              window.history.replaceState(null, "", window.location.pathname);
              return;
            }

            log.info("VerifyEmail: Token verified successfully", {
              userId: verifyData.user?.id,
              emailConfirmed: verifyData.user?.email_confirmed_at,
            });

            // Clear the URL hash/params
            window.history.replaceState(null, "", window.location.pathname);

            // Wait a moment for session to be fully established
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (verifyErr) {
            log.error("VerifyEmail: Unexpected error during verification", {
              error:
                verifyErr instanceof Error
                  ? verifyErr.message
                  : "Unknown error",
            });
            setResendError(
              "An error occurred during verification. Please try again."
            );
            setIsChecking(false);
            return;
          }
        }

        // If we have an access token in the hash, we need to set the session explicitly
        // The SSR client doesn't automatically process hash tokens
        if (accessToken && !tokenHash) {
          log.debug(
            "VerifyEmail: Found access_token in hash, setting session explicitly"
          );

          try {
            const refreshToken = hashParams.get("refresh_token");

            if (refreshToken) {
              // Set the session using the tokens from the hash
              const { data: sessionData, error: setSessionError } =
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

              if (setSessionError) {
                log.error("VerifyEmail: Error setting session from hash", {
                  error: setSessionError.message,
                });
                setResendError(
                  `Failed to establish session: ${setSessionError.message}`
                );
                setIsChecking(false);
                return;
              }

              log.info("VerifyEmail: Session established from hash tokens", {
                userId: sessionData.session?.user?.id,
                emailConfirmed: sessionData.session?.user?.email_confirmed_at,
              });

              // Clear the URL hash after setting session
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search
              );

              // Wait a moment for session to be fully established
              await new Promise((resolve) => setTimeout(resolve, 300));
            } else {
              log.warn("VerifyEmail: access_token found but no refresh_token");
            }
          } catch (setSessionErr) {
            log.error("VerifyEmail: Unexpected error setting session", {
              error:
                setSessionErr instanceof Error
                  ? setSessionErr.message
                  : "Unknown error",
            });
            setResendError(
              "An error occurred while establishing your session. Please try again."
            );
            setIsChecking(false);
            return;
          }
        }

        // Use getUser() first to verify with server (more secure than getSession)
        let user = null;
        const {
          data: { user: userData },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          // Only log if it's not the expected "no session" case
          if (userError.message !== "Auth session missing!") {
            log.error("VerifyEmail: Error getting user", {
              error: userError.message,
            });
          } else {
            log.debug(
              "VerifyEmail: No user session (expected for unverified users)"
            );
          }
        } else if (userData) {
          user = userData;
          log.debug("VerifyEmail: User found", {
            userId: userData.id,
            email: userData.email,
            emailConfirmed: !!userData.email_confirmed_at,
          });
        }

        log.debug("VerifyEmail: Verification status check", {
          hasUser: !!user,
          emailConfirmed: !!user?.email_confirmed_at,
          userId: user?.id,
        });

        if (user?.email_confirmed_at) {
          setIsVerified(true);
          setIsChecking(false);

          // Redirect to onboarding after showing success message
          setTimeout(() => {
            router.push("/onboarding");
          }, 3000); // Give user time to see the success message
        } else {
          setIsVerified(false);
          setIsChecking(false);
        }
      } catch (error) {
        log.error("VerifyEmail: Error checking verification status", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        setIsChecking(false);
      }
    };

    checkVerificationStatus();

    // Poll for verification status every 5 seconds (only if not verified)
    const interval = setInterval(() => {
      if (!isVerified) {
        checkVerificationStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router, isVerified]);

  const handleResendEmail = async () => {
    if (!email) {
      setResendError("Email address is required");
      return;
    }

    try {
      setIsResending(true);
      setResendError(null);
      setResendSuccess(false);

      log.debug("VerifyEmail: Resending verification email", { email });

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${
            window.location.origin
          }/verify-email?email=${encodeURIComponent(email)}`,
        },
      });

      if (error) {
        log.error("VerifyEmail: Failed to resend verification email", {
          error: error.message,
        });
        setResendError(error.message);
      } else {
        log.info("VerifyEmail: Verification email resent successfully");
        setResendSuccess(true);
        // Clear success message after 5 seconds
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch (error) {
      log.error("VerifyEmail: Unexpected error resending email", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setResendError(
        error instanceof Error ? error.message : "Failed to resend email"
      );
    } finally {
      setIsResending(false);
    }
  };

  if (isChecking) {
    return (
      <div className="h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">
              Email Verified Successfully!
            </CardTitle>
            <CardDescription className="text-center">
              Your email address has been confirmed. You&apos;re all set to get
              started!
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Redirecting you to onboarding...
              </span>
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/onboarding">Continue to Onboarding</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Mail className="h-16 w-16 text-primary" />
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification email to{" "}
            <span className="font-semibold">
              {email || "your email address"}
            </span>
            . Please check your inbox and click the verification link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resendSuccess && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Verification email sent! Please check your inbox.
              </AlertDescription>
            </Alert>
          )}

          {resendError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{resendError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Didn&apos;t receive the email?</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Check your spam/junk folder</li>
              <li>Make sure the email address is correct</li>
              <li>Wait a few minutes and try again</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            onClick={handleResendEmail}
            disabled={isResending || !email}
            variant="outline"
            className="w-full cursor-pointer"
          >
            {isResending ? "Sending..." : "Resend Verification Email"}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already verified?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Export wrapper with Suspense boundary
export default function VerifyEmail() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
