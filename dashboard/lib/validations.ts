import { z } from "zod";

export const workerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
});

export type WorkerFormData = z.infer<typeof workerSchema>;

export const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  address: z.string().min(1, "Address is required"),
  contact_person: z.string().min(1, "Contact person is required"),
  phone: z.string().optional(),
});

export type LocationFormData = z.infer<typeof locationSchema>;
