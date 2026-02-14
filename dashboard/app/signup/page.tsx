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
import { formatZodErrors, signUpSchema } from "@/lib/validations";
import { EdgeFunctionError, invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import Link from "next/link";
import { useState } from "react";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    organisation?: string;
    email?: string;
    password?: string;
  }>({});

  const validateInput = () => {
    log.debug("SignUp: Validating form input");

    const result = signUpSchema.safeParse({
      email,
      organisation,
      password,
    });

    if (!result.success) {
      const fieldErrors = formatZodErrors<{
        organisation: string;
        email: string;
        password: string;
      }>(result.error);
      log.warn("SignUp: Form validation failed", { errors: fieldErrors });
      setErrors(fieldErrors);
      throw new Error("Validation failed");
    }

    log.debug("SignUp: Form validation passed");
    // Clear errors on successful validation
    setErrors({});
    return result.data;
  };

  const handleSignup = async () => {
    try {
      log.info("SignUp: Starting signup process");
      setIsLoading(true);
      setErrors({});
      setGeneralError(null);

      const validatedData = validateInput();

      log.debug("SignUp: Calling register-organization function", {
        // Never log emails; organization name can be sensitive too, so log only presence.
        hasEmail: !!validatedData.email,
        hasOrganisation: !!validatedData.organisation,
      });

      const data = await invokeEdgeFunction<{
        organization?: { id?: string; org_code?: string };
        error?: string;
      }>("register-organization", validatedData as unknown as Record<string, unknown>);

      if (data?.error) throw new Error(data.error);

      log.info("SignUp: Organization registered successfully", {
        organizationId: data?.organization?.id,
        orgCode: data?.organization?.org_code,
      });

      // Verification email is sent automatically by the backend
      // during organization registration

      setEmail("");
      setPassword("");
      setOrganisation("");
      setErrors({});

      log.info(
        "SignUp: Signup process completed, redirecting to verification page"
      );
      // Redirect to verification page - email should have been sent by backend
      window.location.href = `/verify-email?email=${encodeURIComponent(
        validatedData.email
      )}`;
    } catch (error) {
      // Errors are already set in validateInput via setErrors
      if (error instanceof EdgeFunctionError) {
        log.error("SignUp: Signup process failed", {
          error: error.message,
          code: error.code,
          status: error.status,
        });
        setGeneralError(error.message);
      } else if (error instanceof Error && error.message !== "Validation failed") {
        log.error("SignUp: Signup process failed", {
          error: error.message,
        });
        setGeneralError(error.message);
      } else if (error && typeof error === "object" && "message" in error) {
        // Handle error objects that aren't Error instances
        const errorMessage = String(error.message);
        log.error("SignUp: Signup process failed", { error: errorMessage });
        setGeneralError(errorMessage);
      } else {
        // Handle unknown error types
        const errorMessage = error ? String(error) : "An unknown error occurred";
        log.error("SignUp: Signup process failed", { error: errorMessage });
        setGeneralError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Enter your organization details to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {generalError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {generalError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="organization">Organization Name</Label>
            <Input
              id="organization"
              name="organization"
              type="text"
              value={organisation}
              onChange={(e) => {
                setOrganisation(e.target.value);
                if (errors.organisation) {
                  setErrors((prev) => ({ ...prev, organisation: undefined }));
                }
              }}
              placeholder="Acme Inc."
              aria-invalid={!!errors.organisation}
              required
            />
            {errors.organisation && (
              <p className="text-sm text-destructive">{errors.organisation}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              required
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              required
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            className="w-full cursor-pointer"
            onClick={handleSignup}
            type="submit"
            disabled={isLoading}
          >
            Sign Up
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
