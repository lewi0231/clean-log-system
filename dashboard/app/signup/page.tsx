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
import { formatZodErrors, signUpSchema } from "@/lib/validations";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUp() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
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

      const validatedData = validateInput();

      log.debug("SignUp: Calling register-organization function", {
        email: validatedData.email,
        organisation: validatedData.organisation,
      });

      const { data, error } = await supabase.functions.invoke(
        "register-organization",
        {
          body: validatedData,
        }
      );

      if (error) {
        log.error("SignUp: Organization registration failed", {
          error: error.message,
        });
        throw new Error(error.message);
      }

      log.info("SignUp: Organization registered successfully", {
        organizationId: data?.organization?.id,
        orgCode: data?.organization?.org_code,
      });

      log.debug("SignUp: Signing in user after registration");
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password,
        });

      if (signInError) {
        log.error("SignUp: Sign in after registration failed", {
          error: signInError.message,
        });
        throw new Error(signInError.message);
      }

      log.info("SignUp: User signed in successfully", {
        userId: authData.user?.id,
        email: authData.user?.email,
      });

      setEmail("");
      setPassword("");
      setOrganisation("");
      setErrors({});

      log.info("SignUp: Signup process completed, redirecting to dashboard");
      // Use window.location for full page reload to ensure middleware sees the session
      window.location.href = "/dashboard";
    } catch (error) {
      // Errors are already set in validateInput via setErrors
      if (error instanceof Error && error.message !== "Validation failed") {
        log.error("SignUp: Signup process failed", { error: error.message });
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
            <Input
              id="password"
              name="password"
              type="password"
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
