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
  additionalHeaders?: HeadersInit
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
  additionalHeaders?: HeadersInit
): Response {
  const errorMessage = error instanceof Error ? error.message : error;

  return jsonResponse({ error: errorMessage }, status, additionalHeaders);
}

/**
 * Wrap a handler function with automatic error handling and CORS
 */
export async function withCorsAndErrorHandling(
  req: Request,
  handler: (req: Request) => Promise<Response>
): Promise<Response> {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    return await handler(req);
  } catch (error) {
    console.error("Handler error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return errorResponse(errorMessage, 500);
  }
}
