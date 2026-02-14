/**
 * Rate limiting utility for Edge Functions
 * Uses in-memory storage (for single-instance) or database (for distributed)
 *
 * Note: For production with multiple instances, consider using Redis or Supabase Realtime
 */

import { createServiceRoleClient } from "./supabase.ts";
import { CORS_HEADERS, ProblemDetails } from "./http.ts";
import { createLoggerWithoutRequest } from "./logger.ts";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  identifier?: string; // Optional custom identifier (defaults to IP)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry allowed
}

/**
 * Get client identifier from request (IP address or custom header)
 */
function getClientIdentifier(req: Request, customIdentifier?: string): string {
  if (customIdentifier) {
    return customIdentifier;
  }

  // Try to get IP from various headers (for proxied requests)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a default identifier
  return "unknown";
}

/**
 * Simple in-memory rate limiter (for single-instance deployments)
 * Note: This won't work across multiple edge function instances
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  check(
    identifier: string,
    maxRequests: number,
    windowMs: number,
  ): RateLimitResult {
    const now = Date.now();
    const key = identifier;
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      // Create new window
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(resetAt),
      };
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        retryAfter,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: new Date(entry.resetAt),
    };
  }

  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global in-memory rate limiter instance
const inMemoryLimiter = new InMemoryRateLimiter();

/**
 * Database-backed rate limiter (for distributed deployments)
 * Uses a simple table to track rate limit windows
 */
async function checkDatabaseRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const logger = createLoggerWithoutRequest({ functionName: "checkDatabaseRateLimit" });
  const supabase = createServiceRoleClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // Get or create rate limit entry
  const { data: existing, error: fetchError } = await supabase
    .from("rate_limit")
    .select("*")
    .eq("identifier", identifier)
    .gt("window_start", windowStart.toISOString())
    .order("window_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    // Error other than "not found" - allow request but log error
    logger.error("Rate limit check error", undefined, { error: fetchError.message });
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  if (existing) {
    if (existing.request_count >= maxRequests) {
      const resetAt = new Date(existing.window_start);
      resetAt.setMilliseconds(resetAt.getMilliseconds() + windowMs);
      const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Increment count
    const { error: updateError } = await supabase
      .from("rate_limit")
      .update({
        request_count: existing.request_count + 1,
        last_request_at: now.toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      logger.warn("Rate limit update error", { error: updateError.message });
    }

    const resetAt = new Date(existing.window_start);
    resetAt.setMilliseconds(resetAt.getMilliseconds() + windowMs);

    return {
      allowed: true,
      remaining: maxRequests - (existing.request_count + 1),
      resetAt,
    };
  }

  // Create new window
  const windowStartIso = now.toISOString();
  const resetAt = new Date(now.getTime() + windowMs);

  const { error: insertError } = await supabase
    .from("rate_limit")
    .insert({
      identifier,
      window_start: windowStartIso,
      request_count: 1,
      last_request_at: windowStartIso,
    });

  if (insertError) {
    logger.warn("Rate limit insert error", { error: insertError.message });
    // Allow request if insert fails
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - 1,
    resetAt,
  };
}

/**
 * Check rate limit for a request
 *
 * @param req - Request object
 * @param config - Rate limit configuration
 * @param useDatabase - Whether to use database (default: false, uses in-memory)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  req: Request,
  config: RateLimitConfig,
  useDatabase = false,
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(req, config.identifier);

  if (useDatabase) {
    return await checkDatabaseRateLimit(
      identifier,
      config.maxRequests,
      config.windowMs,
    );
  }

  // Use in-memory limiter
  // Cleanup old entries periodically (10% chance on each request)
  if (Math.random() < 0.1) {
    inMemoryLimiter.cleanup();
  }

  return inMemoryLimiter.check(identifier, config.maxRequests, config.windowMs);
}

/**
 * Create a rate limit error response with RFC 7807 Problem Details format
 */
export function rateLimitResponse(
  result: RateLimitResult,
  maxRequests: number,
  correlationId?: string,
): Response {
  const problemDetails: ProblemDetails = {
    type: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429",
    title: "Too Many Requests",
    status: 429,
    detail:
      `Rate limit exceeded. Please try again after ${result.retryAfter} seconds.`,
    retryAfter: result.retryAfter,
    resetAt: result.resetAt.toISOString(),
  };

  return new Response(
    JSON.stringify(problemDetails),
    {
      status: 429,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/problem+json",
        "X-RateLimit-Limit": String(maxRequests),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
        "Retry-After": result.retryAfter ? String(result.retryAfter) : "60",
        ...(correlationId && { "x-correlation-id": correlationId }),
      },
    },
  );
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  // Strict: 10 requests per minute
  strict: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  // Moderate: 60 requests per minute
  moderate: {
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
  // Lenient: 100 requests per minute
  lenient: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
  // Per hour limits
  hourly: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000,
  },
} as const;
