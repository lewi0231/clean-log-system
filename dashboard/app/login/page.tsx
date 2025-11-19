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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const handleLogin = async () => {
    try {
      log.info("Login: Starting login process", { email });
      setIsLoading(true);
      setErrors({});

      // TODO - duplicate code - make this reusuable
      const validation = LoginSchema.safeParse({ email, password });
      if (!validation.success) {
        const fieldErrors: {
          email?: string;
          password?: string;
        } = {};

        validation.error.issues.forEach((issue) => {
          const path = issue.path[0] as string;
          if (path === "email" || path === "password") {
            fieldErrors[path] = issue.message;
          }
        });

        log.warn("Login: Form validation failed", { errors: fieldErrors });
        setErrors(fieldErrors);
        return;
      }

      log.debug("Login: Attempting to sign in user");
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: validation.data.email,
          password: validation.data.password,
        });

      if (signInError) {
        log.error("Login: Sign in failed", {
          error: signInError.message,
          email,
        });
        // Most auth errors relate to invalid credentials - assign to password field
        setErrors({ password: signInError.message });
        return;
      }

      log.info("Login: User signed in successfully", {
        userId: data.user?.id,
        email: data.user?.email,
      });

      setEmail("");
      setPassword("");
      log.info("Login: Login process completed, redirecting to home");
      router.push("/");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      log.error("Login: Login process failed", { error: errorMessage });
      setErrors({ password: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex justify-center items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            className="w-full"
            type="submit"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
