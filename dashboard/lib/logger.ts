/**
 * Central logging for the dashboard (browser + Node server components + middleware).
 *
 * Uses `loglevel` — lightweight, works in Next.js middleware (Edge) and client bundles.
 *
 * **Levels:** trace < debug < info < warn < error < silent
 * - Production default: `warn` (no info/debug noise).
 * - Development default: `debug`.
 *
 * **Override:** set `LOG_LEVEL` or `NEXT_PUBLIC_LOG_LEVEL` to a loglevel name
 * (`trace`|`debug`|`info`|`warn`|`error`|`silent`). Client code only sees `NEXT_PUBLIC_*`.
 *
 * **Scoped loggers:** prefer `createLogger("InvoiceList")` for grep-friendly tags.
 *
 * **Sentry:** use `Sentry.captureException` at call sites for errors you need in telemetry;
 * or wrap `log.methodFactory` later to forward `error` level to Sentry breadcrumbs.
 *
 * @see https://github.com/pimterry/loglevel
 */
import log from "loglevel";
import type { Logger } from "loglevel";

function resolveLevel(): log.LogLevelDesc {
  const explicit =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_LOG_LEVEL) ||
    (typeof process !== "undefined" && process.env?.LOG_LEVEL);
  if (explicit) {
    return explicit as log.LogLevelDesc;
  }
  return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

log.setLevel(resolveLevel());

/**
 * Root logger — use for one-off logs. Prefer `createLogger(scope)` in larger modules.
 */
export { log };

/**
 * Returns a named logger (same global level; prefix is the logger name in output).
 */
export function createLogger(scope: string): Logger {
  const child = log.getLogger(scope);
  child.setLevel(log.getLevel());
  return child;
}
