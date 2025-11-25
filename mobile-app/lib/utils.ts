import { FieldConfig } from "@/shared/types/field-config";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createSchemaFromFieldConfig(fieldConfigs: FieldConfig[]) {
  const schema: Record<string, any> = {};

  for (const field of fieldConfigs) {
    const validationRules = field.validation_rules;
    let zodType = undefined;

    switch (field.field_type) {
      case "text":
      case "textarea":
        zodType = z.string();

        if (validationRules) {
          if (validationRules.minLength !== undefined) {
            zodType = zodType.min(
              validationRules.minLength,
              validationRules.customMessage ||
                `${field.label} must be at least ${validationRules.minLength} characters`
            );
          }
          if (validationRules.maxLength !== undefined) {
            zodType = zodType.max(
              validationRules.maxLength,
              validationRules.customMessage ||
                `${field.label} must be at most ${validationRules.maxLength} characters`
            );
          }
          if (validationRules.pattern) {
            zodType = zodType.regex(
              new RegExp(validationRules.pattern),
              validationRules.customMessage ||
                `${field.label} format is invalid`
            );
          }
        }
        break;

      case "email":
        zodType = z.email(
          validationRules?.customMessage ||
            `${field.label} must be a valid email address`
        );
        if (validationRules) {
          if (validationRules.minLength !== undefined) {
            zodType = zodType.min(
              validationRules.minLength,
              validationRules.customMessage ||
                `${field.label} must be at least ${validationRules.minLength} characters`
            );
          }
          if (validationRules.maxLength !== undefined) {
            zodType = zodType.max(
              validationRules.maxLength,
              validationRules.customMessage ||
                `${field.label} must be at most ${validationRules.maxLength} characters`
            );
          }
          if (validationRules.pattern) {
            zodType = zodType.regex(
              new RegExp(validationRules.pattern),
              validationRules.customMessage ||
                `${field.label} format is invalid`
            );
          }
        }
        break;
      case "phone":
        zodType = z.string();

        if (validationRules) {
          if (validationRules.pattern) {
            zodType = zodType.regex(
              new RegExp(validationRules.pattern),
              validationRules.customMessage ||
                `${field.label} must be a valid phone number`
            );
          }
        }
        break;
      case "number":
        zodType = z.number();

        if (validationRules) {
          if (validationRules.min !== undefined) {
            zodType = zodType.min(
              validationRules.min,
              validationRules.customMessage ||
                `${field.label} must be at least ${validationRules.min} characters`
            );
          }
          if (validationRules.max !== undefined) {
            zodType = zodType.max(
              validationRules.max,
              validationRules.customMessage ||
                `${field.label} must be at most ${validationRules.max}`
            );
          }
        }
        break;
      case "select":
        if (field.options && field.options.length > 0) {
          zodType = z.enum(field.options as [string, ...string[]], {
            error: () => ({
              message:
                validationRules?.customMessage ||
                `${field.label} must be one of ${field.options?.join(", ")}`,
            }),
          });
        } else {
          zodType = z.string();
        }
        break;
      case "date":
        zodType = z.date(
          validationRules?.customMessage ||
            `${field.label} must be a valid date`
        );
        break;
      case "time":
        zodType = z
          .string()
          .regex(
            /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
            validationRules?.customMessage ||
              `${field.label} must be in HH:mm format`
          );
        break;
      case "grouped_breakdown":
        const breakdownItemSchema = z.object({
          brand: z.string().min(1, "Brand is required"),
          quantity: z.number().int().min(0, "Quantity must be non-negative"),
        });
        zodType = z.array(breakdownItemSchema);

        if (validationRules) {
          if (validationRules.min_items !== undefined) {
            zodType = zodType.min(
              validationRules.min_items,
              validationRules.customMessage ||
                `${field.label} must have at least ${validationRules.min_items} item(s)`
            );
          }
          if (validationRules.max_items !== undefined) {
            zodType = zodType.max(
              validationRules.max_items,
              validationRules.customMessage ||
                `${field.label} must have at most ${validationRules.max_items} item(s)`
            );
          }
        }
        break;
      default:
        zodType = z.any();
    }
    if (!field.required) {
      zodType = zodType.optional();
    }
    const name = field.name as string;
    schema[name] = zodType;
  }
  return z.object(schema);
}
