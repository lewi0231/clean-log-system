"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import { buildWorkerSignupSchema } from "@/lib/worker-signup-schema";
import { requiresContractorTaxDetails } from "@clean-log/shared/utils/workforce-engagement";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type InvitationPreview = {
  invitation?: {
    worker_email?: string;
    workforce_engagement?: string | null;
    engagement_type?: string | null;
    worker?: { id?: string } | null;
  };
};

function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [abn, setAbn] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingInvitation, setFetchingInvitation] = useState(true);
  const [invitationLoaded, setInvitationLoaded] = useState(false);
  const [workerEmail, setWorkerEmail] = useState<string | null>(null);
  const [workforceEngagement, setWorkforceEngagement] = useState<string | null>(null);
  const [engagementType, setEngagementType] = useState<string | null>(null);

  const router = useRouter();

  // Only compute after preview succeeds — avoids hiding ABN for contractors when load failed.
  const requireTaxDetails = useMemo(() => {
    if (!invitationLoaded) return false;
    return requiresContractorTaxDetails(workforceEngagement, engagementType);
  }, [invitationLoaded, workforceEngagement, engagementType]);

  const validate = () => {
    log.debug("Accept Invite: Validating worker signup form", { requireTaxDetails });

    const result = buildWorkerSignupSchema(requireTaxDetails).safeParse({
      password,
      address,
      abn,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      const errorMessage = firstError.message;

      log.warn("Accept Invite: Form validation failed", {
        errors: result.error.issues,
      });
      setError(errorMessage);
      throw new Error("Validation failed");
    }

    log.debug("Accept Invite: Form validation success");
    setError("");
    return result.data;
  };

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError("Invalid invitation link");
        setFetchingInvitation(false);
        setInvitationLoaded(false);
        return;
      }

      try {
        // Never log tokens or other secrets.
        log.debug("Accept Invite: Fetching invitation details", { hasToken: !!token });
        const data = await invokeEdgeFunction<InvitationPreview>("get-worker", token);

        if (data?.invitation?.worker?.id) {
          setWorkerEmail(data.invitation.worker_email ?? null);
          setWorkforceEngagement(data.invitation.workforce_engagement ?? null);
          setEngagementType(data.invitation.engagement_type ?? null);
          setInvitationLoaded(true);
          // Never log PII (emails).
          log.debug("Accept Invite: Invitation loaded", {
            hasEmail: true,
            workforce_engagement: data.invitation.workforce_engagement ?? null,
            engagement_type: data.invitation.engagement_type ?? null,
          });
        } else if (data?.invitation) {
          setInvitationLoaded(false);
          setError("Invitation is missing worker details. Contact your administrator.");
        } else {
          setInvitationLoaded(false);
          setError("Invitation not found");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load invitation. Please try again.";
        log.error("Accept Invite: Error fetching invitation", {
          error: message,
        });
        setInvitationLoaded(false);
        setError(message);
      } finally {
        setFetchingInvitation(false);
      }
    };

    fetchInvitation();
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    try {
      e.preventDefault();
      if (!invitationLoaded) {
        setError("Invitation details are not available. Reload this page and try again.");
        return;
      }

      setLoading(true);
      setError("");

      const validatedData = validate();
      log.debug("Accept Invite: Calling accept-worker-invitation", {
        hasToken: !!token,
        requireTaxDetails,
      });

      const data = await invokeEdgeFunction<{ success?: boolean; error?: string }>(
        "accept-worker-invitation",
        {
          invitation_token: token,
          password: validatedData.password,
          address: validatedData.address ?? "",
          abn: validatedData.abn ?? "",
        }
      );

      if (data?.error) {
        log.warn("Accept Invite: Server returned error", { message: data.error });
        setError(data.error);
        return;
      }

      log.info("Accept Invite: Worker invitation accepted");

      // Redirect to success page
      router.push("/worker/signup-success");
    } catch (error) {
      if (error instanceof Error) {
        log.error("Accept Invite: Failed", { error: error.message });
        // Don't set error if it's a validation error (already set)
        if (!error.message.includes("Validation failed")) {
          setError(error.message || "An unexpected error occurred. Please try again.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (fetchingInvitation) {
    return (
      <div className="h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitationLoaded) {
    return (
      <div className="h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
            <CardDescription>
              We could not load this invitation. The link may be invalid or expired.
            </CardDescription>
          </CardHeader>
          <CardContent>{error && <p className="text-sm text-destructive">{error}</p>}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Up Your Tally Runner Account</CardTitle>
          <CardDescription>
            {workerEmail
              ? `Creating account for ${workerEmail}`
              : "Complete your account setup by providing the required information"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAccept}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create a Password</Label>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="At least 6 characters"
                aria-invalid={!!error}
                required
              />
              <p className="text-xs text-muted-foreground">
                You&apos;ll use this to log into the Tally Runner mobile app that you&apos;ll
                install later.
              </p>
            </div>
            {requireTaxDetails && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Business address</Label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (error) {
                        setError("");
                      }
                    }}
                    placeholder="123 Main St, City, State 12345"
                    aria-invalid={!!error}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Used on contractor tax invoices.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN (Australian Business Number)</Label>
                  <Input
                    id="abn"
                    name="abn"
                    type="text"
                    value={abn}
                    onChange={(e) => {
                      setAbn(e.target.value);
                      if (error) {
                        setError("");
                      }
                    }}
                    placeholder="11 222 333 444"
                    aria-invalid={!!error}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for contractor tax invoicing.
                  </p>
                </div>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 mt-4">
            <Button className="w-full cursor-pointer" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default AcceptInvitePage;
