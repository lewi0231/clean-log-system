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
import { Label } from "@/components/ui/label";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { z } from "zod";

const PasswordSchema = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(20, "Password cannot be more than 20 characters")
    .refine(
      (password) => /[A-Z]/.test(password),
      "Password must contain at least one uppercase letter"
    )
    .refine(
      (password) => /[a-z]/.test(password),
      "Password must contain at least one lowercase letter"
    )
    .refine(
      (password) => /[0-9]/.test(password),
      "Password must contain at least one number"
    ),
});

function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fetchingInvitation, setFetchingInvitation] = useState(true);
  const [workerEmail, setWorkerEmail] = useState<string | null>(null);

  const router = useRouter();

  const validate = () => {
    log.debug("Accept Invite: Validating worker password");

    const result = PasswordSchema.safeParse({ password });

    if (!result.success) {
      const passwordError = result.error.issues[0].message;

      log.warn("Accept Invite: Form validation failed", {
        errors: passwordError,
      });
      setError(passwordError);
      throw new Error("Validation failed");
    }

    log.debug("Accept Invite: Password validation success");
    setError("");
    return result.data;
  };

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError("Invalid invitation link");
        setFetchingInvitation(false);
        return;
      }

      try {
        log.debug("Accept Invite: Fetching invitation details", { token });
        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-worker",
          {
            body: token,
          }
        );

        if (fetchError) {
          log.error("Accept Invite: Failed to fetch invitation", fetchError);
          setError(
            fetchError.message ||
              "Failed to load invitation. Please check your link."
          );
          setFetchingInvitation(false);
          return;
        }

        if (data?.invitation) {
          setWorkerEmail(data.invitation.worker_email);
          log.debug("Accept Invite: Invitation loaded", {
            email: data.invitation.worker_email,
          });
        }
      } catch (err) {
        log.error("Accept Invite: Error fetching invitation", err);
        setError("Failed to load invitation. Please try again.");
      } finally {
        setFetchingInvitation(false);
      }
    };

    fetchInvitation();
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    try {
      e.preventDefault();
      setLoading(true);
      setError("");

      const validatedPassword = validate();
      log.debug("Accept Invite: Calling accept-worker-invitation", {
        token,
      });

      const { data, error: acceptError } = await supabase.functions.invoke(
        "accept-worker-invitation",
        {
          body: {
            invitation_token: token,
            password: validatedPassword.password,
          },
        }
      );

      if (acceptError) {
        log.error(
          "Accept Invite: accept worker invitation failed",
          acceptError.message
        );
        setError(
          acceptError.message || "Failed to create account. Please try again."
        );
        return;
      }

      if (data?.error) {
        log.error("Accept Invite: Server returned error", data.error);
        setError(data.error);
        return;
      }

      log.info("Accept Invite: Worker invitation accepted", data);
      setSuccess(true);

      // TODO - ultimately will be a redirect to download the phone application.
      // for now redirect to home.
      router.push("/");
    } catch (error) {
      if (error instanceof Error) {
        log.error("Accept Invite: Failed", { error: error.message });
        // Don't set error if it's a validation error (already set)
        if (!error.message.includes("Validation failed")) {
          setError(
            error.message || "An unexpected error occurred. Please try again."
          );
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

  if (success) {
    return (
      <div className="h-screen w-full flex justify-center items-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-center">Welcome!</CardTitle>
            <CardDescription className="text-center">
              Your account has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center text-muted-foreground">
              Redirecting to mobile application...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Up Your CleanLog Account</CardTitle>
          <CardDescription>
            {workerEmail
              ? `Creating account for ${workerEmail}`
              : "Create a password to complete your account setup"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAccept}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create a Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
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
                You&apos;ll use this to log into CleanLog mobile app that
                you&apos;ll install later.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full cursor-pointer"
              type="submit"
              disabled={loading}
            >
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
