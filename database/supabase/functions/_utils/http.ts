// HTTP utilities for Edge Functions
// Provides CORS headers, response builders, and error handlers

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
} as const;

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  additionalHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  error: string | Error,
  status = 500,
  additionalHeaders?: HeadersInit,
): Response {
  const errorMessage = error instanceof Error ? error.message : error;

  return jsonResponse({ error: errorMessage }, status, additionalHeaders);
}

/**
 * Determine HTTP status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("authentication") ||
      message.includes("user not found") ||
      message.includes("unauthorized")
    ) {
      return 401;
    }
    if (message.includes("not found") || message.includes("does not exist")) {
      return 404;
    }
    if (
      message.includes("required") ||
      message.includes("invalid") ||
      message.includes("missing")
    ) {
      return 400;
    }
    if (
      message.includes("does not match") ||
      message.includes("permission") ||
      message.includes("forbidden")
    ) {
      return 403;
    }
    if (message.includes("conflict") || message.includes("already exists")) {
      return 409;
    }
  }
  return 500;
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(
  error: unknown,
  defaultMessage = "Internal server error",
): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return defaultMessage;
}

/**
 * Wrap a handler function with automatic error handling and CORS
 * @deprecated Prefer using structured logger and manual error handling for better control
 */
export async function withCorsAndErrorHandling(
  req: Request,
  handler: (req: Request) => Promise<Response>,
): Promise<Response> {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    return await handler(req);
  } catch (error) {
    // Note: This should use structured logger, but keeping for backward compatibility
    console.error("Handler error:", error);
    const errorMessage = extractErrorMessage(error);
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
}
