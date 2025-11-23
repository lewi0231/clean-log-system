"use client";

import { supabase } from "@/lib/supabase";
import log from "loglevel";
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
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow text-center">
        <p className="text-gray-600">Loading invitation...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2 text-green-600">Welcome!</h1>
        <p className="text-gray-600">
          Your account has been created successfully.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Redirecting to mobile application...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto  p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Set Up Your CleanLog Account</h1>
      {workerEmail && (
        <p className="text-sm text-gray-600 mb-4">
          Creating account for:{" "}
          <span className="font-semibold">{workerEmail}</span>
        </p>
      )}

      <form onSubmit={handleAccept} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Create a Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            You&apos;ll use this to log into CleanLog mobile app that
            you&apos;ll install later.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export default AcceptInvitePage;
