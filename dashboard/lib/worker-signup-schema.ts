import { z } from "zod";

const passwordSchema = z
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
  .refine((password) => /[0-9]/.test(password), "Password must contain at least one number");

/** Zod schema for worker accept-invite; tax fields required only for contractors. */
export function buildWorkerSignupSchema(requireTaxDetails: boolean) {
  return z.object({
    password: passwordSchema,
    address: requireTaxDetails
      ? z.string().min(1, "Address is required")
      : z.string().optional().default(""),
    abn: requireTaxDetails
      ? z.string().min(1, "ABN is required")
      : z.string().optional().default(""),
  });
}

export type WorkerSignupFormData = z.infer<ReturnType<typeof buildWorkerSignupSchema>>;
