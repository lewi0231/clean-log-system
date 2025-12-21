/**
 * Structured logging utility for Edge Functions
 * Provides consistent logging with correlation IDs and PII sanitization
 */

interface LogContext {
  correlationId?: string;
  organizationId?: string;
  userId?: string;
  functionName?: string;
  [key: string]: unknown;
}

interface SanitizeOptions {
  removeFields?: string[];
  maskFields?: string[];
  maskLength?: number;
}

/**
 * Sanitize sensitive data from log objects
 * Removes or masks PII and sensitive information
 */
export function sanitizeLogData(
  data: unknown,
  options: SanitizeOptions = {},
): unknown {
  const {
    removeFields = [
      "password",
      "token",
      "secret",
      "api_key",
      "authorization",
      "stripe_secret",
      "webhook_secret",
    ],
    maskFields = ["email", "phone", "card_number", "ssn"],
    maskLength = 4,
  } = options;

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Check if string contains email pattern
    if (data.includes("@") && data.includes(".")) {
      const [local, domain] = data.split("@");
      if (local && domain) {
        return `${local.substring(0, 2)}***@${domain}`;
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, options));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Remove sensitive fields
      if (removeFields.some((field) => lowerKey.includes(field))) {
        continue;
      }

      // Mask sensitive fields
      if (maskFields.some((field) => lowerKey.includes(field))) {
        if (typeof value === "string" && value.length > maskLength) {
          sanitized[key] = `${value.substring(0, 2)}***${value.substring(
            value.length - 2,
          )}`;
        } else {
          sanitized[key] = "***";
        }
        continue;
      }

      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLogData(value, options);
    }

    return sanitized;
  }

  return data;
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract correlation ID from request headers or generate new one
 */
export function getCorrelationId(req: Request): string {
  return (
    req.headers.get("x-correlation-id") ||
    req.headers.get("x-request-id") ||
    generateCorrelationId()
  );
}

/**
 * Structured logger for Edge Functions
 */
class EdgeFunctionLogger {
  private correlationId: string;
  private context: LogContext;

  constructor(correlationId?: string, context: LogContext = {}) {
    this.correlationId = correlationId || generateCorrelationId();
    this.context = { ...context, correlationId: this.correlationId };
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): EdgeFunctionLogger {
    return new EdgeFunctionLogger(this.correlationId, {
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    const sanitized = data ? sanitizeLogData(data) : undefined;
    console.log(
      JSON.stringify({
        level: "info",
        message,
        ...this.context,
        ...(sanitized && { data: sanitized }),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    const sanitized = data ? sanitizeLogData(data) : undefined;
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        ...this.context,
        ...(sanitized && { data: sanitized }),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    const sanitized = data ? sanitizeLogData(data) : undefined;
    const errorData = error instanceof Error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : error
        ? { error: sanitizeLogData(error) }
        : {};

    console.error(
      JSON.stringify({
        level: "error",
        message,
        ...this.context,
        ...errorData,
        ...(sanitized && { data: sanitized }),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, data?: unknown): void {
    if (Deno.env.get("ENVIRONMENT") !== "production") {
      const sanitized = data ? sanitizeLogData(data) : undefined;
      console.debug(
        JSON.stringify({
          level: "debug",
          message,
          ...this.context,
          ...(sanitized && { data: sanitized }),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}

/**
 * Create a logger instance for an edge function
 * Usage:
 *   const logger = createLogger(req, { functionName: "create-pricing-rule" });
 *   logger.info("Processing request", { organizationId });
 */
export function createLogger(
  req: Request,
  context: LogContext = {},
): EdgeFunctionLogger {
  const correlationId = getCorrelationId(req);
  return new EdgeFunctionLogger(correlationId, {
    ...context,
    correlationId,
  });
}

/**
 * Create a logger without request context (for background jobs, etc.)
 */
export function createLoggerWithoutRequest(
  context: LogContext = {},
): EdgeFunctionLogger {
  return new EdgeFunctionLogger(undefined, context);
}

