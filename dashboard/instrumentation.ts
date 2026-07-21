/**
 * Next.js instrumentation — keep this free of a top-level `@sentry/nextjs` import.
 * A static import here is rewritten into the edge instrumentation bundle and can
 * crash Turbopack with "module factory is not available" after dependency/HMR churn.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  const { captureRequestError } = await import("@sentry/nextjs");
  return captureRequestError(...args);
}
