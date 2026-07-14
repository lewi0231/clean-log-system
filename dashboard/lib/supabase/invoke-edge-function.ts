import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { EdgeContracts } from "@/lib/types/edge-contracts";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

export class EdgeFunctionError extends Error {
  code?: string;
  status?: number;
  details?: unknown;

  constructor(message: string, opts?: { code?: string; status?: number; details?: unknown }) {
    super(message);
    this.name = "EdgeFunctionError";
    this.code = opts?.code;
    this.status = opts?.status;
    this.details = opts?.details;
  }
}

type InvokeResult<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: EdgeFunctionError;
    };

function makeEdgeFunctionError(message: string): EdgeFunctionError {
  const err = new EdgeFunctionError(message);
  return err;
}

/** Prefer non-empty text; empty strings from APIs are treated as missing. */
function pickMessage(primary: string | undefined | null, fallback: string): string {
  const t = (primary ?? "").trim();
  return t.length > 0 ? t : fallback;
}

/**
 * Some environments surface DNS / transport failures as plain `Error` (not
 * `FunctionsFetchError`). Treat those as fetch errors so callers can skip retries.
 */
function looksLikeEdgeFunctionNetworkFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("name resolution") ||
    m.includes("failed to fetch") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("enotfound") ||
    m.includes("getaddrinfo") ||
    m.includes("err_name_not_resolved") ||
    m.includes("econnrefused") ||
    m.includes("etimedout") ||
    m.includes("timed out")
  );
}

async function toEdgeFunctionError(err: unknown, functionName: string): Promise<EdgeFunctionError> {
  // Supabase error types: https://supabase.com/docs/guides/functions/development-tips
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      // Support RFC 7807 { detail }, { error }, { message }, and nested { error: { message } }
      let fromBody = "";
      if (body && typeof body === "object") {
        const rec = body as Record<string, unknown>;
        if (typeof rec.detail === "string") fromBody = rec.detail;
        else if (typeof rec.error === "string") fromBody = rec.error;
        else if (
          rec.error &&
          typeof rec.error === "object" &&
          typeof (rec.error as { message?: unknown }).message === "string"
        ) {
          fromBody = (rec.error as { message: string }).message;
        } else if (typeof rec.message === "string") {
          fromBody = rec.message;
        }
      }
      const message = pickMessage(
        fromBody || err.message,
        `Edge Function '${functionName}' returned an error (HTTP ${err.context?.status ?? "?"})`
      );
      const out = makeEdgeFunctionError(message);
      // FunctionsHttpError doesn't type `status`, but `context` is a Response.
      out.status = err.context?.status;
      out.details = body;
      return out;
    } catch {
      return makeEdgeFunctionError(
        pickMessage(
          err.message,
          `Edge Function '${functionName}' returned an error (HTTP ${err.context?.status ?? "?"})`
        )
      );
    }
  }

  if (err instanceof FunctionsRelayError) {
    const out = makeEdgeFunctionError(
      pickMessage(err.message, `Relay error calling '${functionName}'`)
    );
    out.code = "relay_error";
    return out;
  }

  if (err instanceof FunctionsFetchError) {
    const out = makeEdgeFunctionError(
      pickMessage(err.message, `Network error calling '${functionName}'`)
    );
    out.code = "fetch_error";
    return out;
  }

  if (err instanceof Error) {
    const out = makeEdgeFunctionError(
      pickMessage(err.message, `Unknown error calling '${functionName}'`)
    );
    if (looksLikeEdgeFunctionNetworkFailure(out.message)) {
      out.code = "fetch_error";
    }
    return out;
  }

  // Handle non-Error objects commonly returned by mocks or loosely typed callers
  if (typeof err === "object" && err !== null) {
    const maybe = err as Record<string, unknown>;
    // Best-effort extraction of message from common Supabase error-like shapes:
    // { message, status, context: { json(), body, data } }
    let extracted: unknown;
    const ctx = maybe.context as Record<string, unknown> | undefined;
    if (ctx && typeof ctx === "object") {
      const jsonFn = (ctx as { json?: unknown }).json;
      if (typeof jsonFn === "function") {
        try {
          extracted = await (jsonFn as () => Promise<unknown>)();
        } catch {
          // ignore
        }
      } else if (typeof (ctx as { body?: unknown }).body === "string") {
        try {
          extracted = JSON.parse((ctx as { body: string }).body);
        } catch {
          // ignore
        }
      } else if (typeof (ctx as { data?: unknown }).data === "object") {
        extracted = (ctx as { data: unknown }).data;
      }
    }

    let extractedMessage = "";
    if (extracted && typeof extracted === "object") {
      const rec = extracted as Record<string, unknown>;
      if (typeof rec.error === "string") extractedMessage = rec.error;
      else if (typeof rec.message === "string") {
        extractedMessage = rec.message;
      }
    }

    const message = pickMessage(
      extractedMessage || (typeof maybe.message === "string" ? maybe.message : ""),
      `Unknown error calling '${functionName}'`
    );
    const status =
      typeof maybe.status === "number"
        ? maybe.status
        : typeof maybe.statusCode === "number"
          ? maybe.statusCode
          : undefined;
    let code = typeof maybe.code === "string" ? maybe.code : undefined;
    const out = makeEdgeFunctionError(message);
    out.status = status;
    if (!code && looksLikeEdgeFunctionNetworkFailure(out.message)) {
      code = "fetch_error";
    }
    out.code = code;
    out.details = extracted ?? err;
    return out;
  }

  const out = makeEdgeFunctionError(`Unknown error calling '${functionName}'`);
  out.details = err;
  return out;
}

/**
 * Human-readable message for UI and logs (never empty when a real error occurred).
 */
export function getInvokeErrorMessage(err: unknown): string {
  if (err instanceof EdgeFunctionError) {
    return pickMessage(err.message, "Edge function request failed");
  }
  if (err instanceof Error) {
    return pickMessage(err.message, "Something went wrong");
  }
  if (typeof err === "string") return pickMessage(err, "Something went wrong");
  return "Something went wrong";
}

/**
 * Invoke a Supabase Edge Function with consistent error handling.
 *
 * - Always throws EdgeFunctionError on failure (with best-effort message extraction).
 * - Keeps a single call-site pattern across all dashboard services.
 */
export async function invokeEdgeFunction<TResponse>(
  functionName: string,
  body?: unknown
): Promise<TResponse> {
  log.debug("invokeEdgeFunction: invoking", { functionName });

  const { data, error } = await supabase.functions.invoke(
    functionName,
    body === undefined || body === null ? undefined : ({ body } as never)
  );

  if (error) {
    const wrapped = await toEdgeFunctionError(error, functionName);
    log.warn("invokeEdgeFunction: error", {
      functionName,
      message: wrapped.message,
    });
    throw wrapped;
  }

  return data as TResponse;
}

/**
 * Invoke an Edge Function with request/response types inferred from {@link EdgeContracts}.
 *
 * Prefer this over `invokeEdgeFunction` + `as unknown as Record<string, unknown>` when the
 * function is registered in `edge-contracts.ts`.
 */
export async function invokeTypedEdge<K extends keyof EdgeContracts>(
  functionName: K,
  body: EdgeContracts[K]["body"]
): Promise<EdgeContracts[K]["response"]> {
  return invokeEdgeFunction<EdgeContracts[K]["response"]>(functionName as string, body);
}

/**
 * Optional helper for call-sites that prefer a Result type.
 */
export async function invokeEdgeFunctionSafe<TResponse>(
  functionName: string,
  body?: unknown
): Promise<InvokeResult<TResponse>> {
  try {
    const data = await invokeEdgeFunction<TResponse>(functionName, body);
    return { data, error: null };
  } catch (e) {
    const err = e instanceof EdgeFunctionError ? e : await toEdgeFunctionError(e, functionName);
    return { data: null, error: err };
  }
}
