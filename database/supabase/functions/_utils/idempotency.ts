/**
 * Idempotency key utility for Edge Functions
 * Ensures mutation operations are processed exactly once
 * 
 * Usage:
 * 1. Client sends `x-idempotency-key` header with unique key (UUID recommended)
 * 2. Server checks if key was used before
 * 3. If yes, returns cached response
 * 4. If no, processes request and caches response
 * 
 * This prevents duplicate operations like double charges, duplicate records, etc.
 */

import { createServiceRoleClient } from "./supabase.ts";
import { CORS_HEADERS, ProblemDetails } from "./http.ts";

interface IdempotencyResult {
  isNew: boolean;
  cachedResponse?: Response;
}

interface StoredIdempotencyRecord {
  id: string;
  idempotency_key: string;
  request_path: string;
  request_method: string;
  response_status: number;
  response_body: string;
  response_headers: Record<string, string>;
  created_at: string;
  expires_at: string;
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("x-idempotency-key") || 
         req.headers.get("idempotency-key");
}

/**
 * Check if idempotency key has been used before
 * Returns cached response if key exists, otherwise returns isNew: true
 * 
 * @param req - Request object
 * @param idempotencyKey - Idempotency key from request
 * @returns IdempotencyResult with cached response or isNew flag
 */
export async function checkIdempotencyKey(
  req: Request,
  idempotencyKey: string,
): Promise<IdempotencyResult> {
  const supabase = createServiceRoleClient();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Query for existing idempotency record
  const { data, error } = await supabase
    .from("idempotency_keys")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .eq("request_path", path)
    .eq("request_method", method)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // Error other than "not found" - treat as new to avoid blocking valid requests
    console.error("Idempotency check error:", error);
    return { isNew: true };
  }

  if (data) {
    // Key exists - return cached response
    const record = data as StoredIdempotencyRecord;
    const cachedResponse = new Response(record.response_body, {
      status: record.response_status,
      headers: {
        ...CORS_HEADERS,
        ...record.response_headers,
        "x-idempotent-replayed": "true",
      },
    });

    return {
      isNew: false,
      cachedResponse,
    };
  }

  return { isNew: true };
}

/**
 * Store idempotency key with response for future requests
 * TTL is 24 hours by default
 * 
 * @param req - Request object
 * @param idempotencyKey - Idempotency key from request
 * @param response - Response to cache
 * @param ttlHours - Time to live in hours (default: 24)
 */
export async function storeIdempotencyKey(
  req: Request,
  idempotencyKey: string,
  response: Response,
  ttlHours = 24,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Clone response to read body without consuming it
  const responseClone = response.clone();
  const responseBody = await responseClone.text();

  // Only cache successful responses (2xx status codes)
  if (response.status < 200 || response.status >= 300) {
    return;
  }

  // Extract relevant headers to cache
  const headersToCache: Record<string, string> = {};
  const headersToCacheList = [
    "content-type",
    "x-correlation-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
  ];

  headersToCacheList.forEach((header) => {
    const value = response.headers.get(header);
    if (value) {
      headersToCache[header] = value;
    }
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  const { error: insertError } = await supabase
    .from("idempotency_keys")
    .insert({
      idempotency_key: idempotencyKey,
      request_path: path,
      request_method: method,
      response_status: response.status,
      response_body: responseBody,
      response_headers: headersToCache,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    // Log error but don't fail the request
    console.error("Failed to store idempotency key:", insertError);
  }
}

/**
 * Require idempotency key for mutation operations
 * Returns error response if key is missing
 * 
 * @param req - Request object
 * @param correlationId - Optional correlation ID for error response
 * @returns null if key exists, error Response if missing
 */
export function requireIdempotencyKey(
  req: Request,
  correlationId?: string,
): Response | null {
  const idempotencyKey = getIdempotencyKey(req);

  if (!idempotencyKey) {
    const problemDetails: ProblemDetails = {
      type: "about:blank",
      title: "Idempotency Key Required",
      status: 400,
      detail: "This operation requires an idempotency key in the x-idempotency-key header to prevent duplicate requests",
    };

    return new Response(JSON.stringify(problemDetails), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/problem+json",
        ...(correlationId && { "x-correlation-id": correlationId }),
      },
    });
  }

  return null;
}

/**
 * Validate idempotency key format (should be UUID v4)
 */
export function isValidIdempotencyKey(key: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(key);
}

/**
 * Validate and require idempotency key
 * Returns error response if key is missing or invalid
 */
export function validateIdempotencyKey(
  req: Request,
  correlationId?: string,
): Response | null {
  const idempotencyKey = getIdempotencyKey(req);

  if (!idempotencyKey) {
    return requireIdempotencyKey(req, correlationId);
  }

  if (!isValidIdempotencyKey(idempotencyKey)) {
    const problemDetails: ProblemDetails = {
      type: "about:blank",
      title: "Invalid Idempotency Key",
      status: 400,
      detail: "Idempotency key must be a valid UUID v4",
    };

    return new Response(JSON.stringify(problemDetails), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/problem+json",
        ...(correlationId && { "x-correlation-id": correlationId }),
      },
    });
  }

  return null;
}
