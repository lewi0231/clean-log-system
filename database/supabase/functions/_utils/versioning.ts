/**
 * API Versioning utility for Edge Functions
 * Implements header-based versioning with date stamps
 * 
 * Pattern: x-api-version: 2026-01-20
 * 
 * Usage:
 * 1. Client sends x-api-version header with date (YYYY-MM-DD)
 * 2. Server checks version and routes to appropriate handler
 * 3. Default to latest version if no header provided
 * 
 * This allows gradual API evolution without breaking existing clients.
 */

import { CORS_HEADERS, ProblemDetails } from "./http.ts";

/**
 * API version definition
 */
export interface ApiVersion {
  date: string; // YYYY-MM-DD format
  label?: string; // Human-readable label (e.g., "v1.0", "beta")
  deprecated?: boolean;
  sunsetDate?: string; // When this version will be removed
}

/**
 * API version registry
 * Add new versions here as the API evolves
 */
export const API_VERSIONS: Record<string, ApiVersion> = {
  "2026-01-20": {
    date: "2026-01-20",
    label: "v1.0",
    deprecated: false,
  },
  // Example of adding a new version:
  // "2026-03-15": {
  //   date: "2026-03-15",
  //   label: "v1.1",
  //   deprecated: false,
  // },
  // Example of deprecating a version:
  // "2025-12-01": {
  //   date: "2025-12-01",
  //   label: "v0.9",
  //   deprecated: true,
  //   sunsetDate: "2026-06-01",
  // },
};

/**
 * Default API version (latest)
 */
export const DEFAULT_API_VERSION = "2026-01-20";

/**
 * Get API version from request headers
 */
export function getApiVersion(req: Request): string {
  return (
    req.headers.get("x-api-version") ||
    req.headers.get("api-version") ||
    DEFAULT_API_VERSION
  );
}

/**
 * Validate API version format (YYYY-MM-DD)
 */
function isValidVersionFormat(version: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(version)) {
    return false;
  }

  // Check if it's a valid date
  const date = new Date(version);
  return !isNaN(date.getTime());
}

/**
 * Check if API version is supported
 */
export function isSupportedVersion(version: string): boolean {
  return version in API_VERSIONS;
}

/**
 * Get version metadata
 */
export function getVersionMetadata(version: string): ApiVersion | null {
  return API_VERSIONS[version] || null;
}

/**
 * Validate API version
 * Returns error response if version is invalid or unsupported
 */
export function validateApiVersion(
  req: Request,
  correlationId?: string,
): Response | null {
  const version = getApiVersion(req);

  // Check format
  if (!isValidVersionFormat(version)) {
    const problemDetails: ProblemDetails = {
      type: "about:blank",
      title: "Invalid API Version",
      status: 400,
      detail: `API version must be in YYYY-MM-DD format. Received: ${version}`,
      supportedVersions: Object.keys(API_VERSIONS),
      defaultVersion: DEFAULT_API_VERSION,
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

  // Check if supported
  if (!isSupportedVersion(version)) {
    const problemDetails: ProblemDetails = {
      type: "about:blank",
      title: "Unsupported API Version",
      status: 400,
      detail: `API version ${version} is not supported. Please use one of the supported versions.`,
      supportedVersions: Object.keys(API_VERSIONS),
      defaultVersion: DEFAULT_API_VERSION,
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

  // Check if deprecated
  const metadata = getVersionMetadata(version);
  if (metadata?.deprecated) {
    // Don't block deprecated versions, but add warning header
    // The actual response will include this header
    return null;
  }

  return null;
}

/**
 * Add version headers to response
 * Includes current version, deprecation warnings, and sunset dates
 */
export function addVersionHeaders(
  headers: HeadersInit,
  version: string,
): HeadersInit {
  const metadata = getVersionMetadata(version);
  const newHeaders: Record<string, string> = {
    ...headers,
    "x-api-version": version,
  };

  if (metadata?.label) {
    newHeaders["x-api-version-label"] = metadata.label;
  }

  if (metadata?.deprecated) {
    newHeaders["deprecation"] = "true";
    newHeaders["x-api-deprecated"] = "true";
    
    if (metadata.sunsetDate) {
      newHeaders["sunset"] = new Date(metadata.sunsetDate).toUTCString();
      newHeaders["x-api-sunset-date"] = metadata.sunsetDate;
    }
  }

  // Add link to latest version in header
  newHeaders["x-api-latest-version"] = DEFAULT_API_VERSION;

  return newHeaders;
}

/**
 * Version-aware handler wrapper
 * Allows different behavior based on API version
 * 
 * Example usage:
 * ```typescript
 * const result = handleVersioned(req, {
 *   "2026-01-20": async () => { ... },
 *   "2026-03-15": async () => { ... },
 * });
 * ```
 */
export async function handleVersioned<T>(
  req: Request,
  handlers: Record<string, () => Promise<T>>,
  defaultHandler?: () => Promise<T>,
): Promise<T> {
  const version = getApiVersion(req);
  
  if (handlers[version]) {
    return await handlers[version]();
  }

  if (defaultHandler) {
    return await defaultHandler();
  }

  // If no matching handler and no default, use latest version handler
  const latestHandler = handlers[DEFAULT_API_VERSION];
  if (latestHandler) {
    return await latestHandler();
  }

  throw new Error(`No handler found for API version: ${version}`);
}

/**
 * Compare two version dates
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const date1 = new Date(v1).getTime();
  const date2 = new Date(v2).getTime();
  
  if (date1 < date2) return -1;
  if (date1 > date2) return 1;
  return 0;
}

/**
 * Check if a feature is available in the current version
 * 
 * Example:
 * ```typescript
 * if (isFeatureAvailable(version, "2026-02-01")) {
 *   // Use new feature
 * } else {
 *   // Use old behavior
 * }
 * ```
 */
export function isFeatureAvailable(
  currentVersion: string,
  featureIntroducedVersion: string,
): boolean {
  return compareVersions(currentVersion, featureIntroducedVersion) >= 0;
}
