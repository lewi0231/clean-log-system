import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import {
    FunctionsFetchError,
    FunctionsHttpError,
    FunctionsRelayError,
} from "@supabase/supabase-js";

export class EdgeFunctionError extends Error {
    code?: string;
    status?: number;
    details?: unknown;

    constructor(
        message: string,
        opts?: { code?: string; status?: number; details?: unknown },
    ) {
        super(message);
        this.name = "EdgeFunctionError";
        this.code = opts?.code;
        this.status = opts?.status;
        this.details = opts?.details;
    }
}

type InvokeResult<T> = { data: T; error: null } | {
    data: null;
    error: EdgeFunctionError;
};

async function toEdgeFunctionError(
    err: unknown,
    functionName: string,
): Promise<EdgeFunctionError> {
    // Supabase error types: https://supabase.com/docs/guides/functions/development-tips
    if (err instanceof FunctionsHttpError) {
        try {
            const body = await err.context.json();
            // Support both custom { error } and RFC 7807 Problem Details { detail }
            const message = (body && typeof body === "object"
                ? ("detail" in body &&
                        typeof (body as { detail?: unknown }).detail ===
                            "string"
                    ? (body as { detail: string }).detail
                    : "error" in body &&
                            typeof (body as { error?: unknown }).error ===
                                "string"
                    ? (body as { error: string }).error
                    : "message" in body &&
                            typeof (body as { message?: unknown }).message ===
                                "string"
                    ? (body as { message: string }).message
                    : err.message)
                : err.message) ||
                `Edge Function '${functionName}' returned an error`;
            return new EdgeFunctionError(message, {
                status: err.status,
                details: body,
            });
        } catch {
            return new EdgeFunctionError(
                err.message ||
                    `Edge Function '${functionName}' returned an error`,
            );
        }
    }

    if (err instanceof FunctionsRelayError) {
        return new EdgeFunctionError(
            err.message || `Relay error calling '${functionName}'`,
            {
                code: "relay_error",
            },
        );
    }

    if (err instanceof FunctionsFetchError) {
        return new EdgeFunctionError(
            err.message || `Network error calling '${functionName}'`,
            {
                code: "fetch_error",
            },
        );
    }

    if (err instanceof Error) {
        return new EdgeFunctionError(
            err.message || `Unknown error calling '${functionName}'`,
        );
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

        const extractedMessage = extracted && typeof extracted === "object" &&
                ("error" in extracted || "message" in extracted)
            ? (typeof (extracted as Record<string, unknown>).error === "string"
                ? (extracted as Record<string, unknown>).error
                : typeof (extracted as Record<string, unknown>).message ===
                        "string"
                ? (extracted as Record<string, unknown>).message
                : undefined)
            : undefined;

        const message = extractedMessage ||
            (typeof maybe.message === "string"
                ? maybe.message
                : `Unknown error calling '${functionName}'`);
        const status = typeof maybe.status === "number"
            ? maybe.status
            : typeof maybe.statusCode === "number"
            ? maybe.statusCode
            : undefined;
        const code = typeof maybe.code === "string" ? maybe.code : undefined;
        return new EdgeFunctionError(message, {
            status,
            code,
            details: extracted ?? err,
        });
    }

    return new EdgeFunctionError(`Unknown error calling '${functionName}'`, {
        details: err,
    });
}

/**
 * Invoke a Supabase Edge Function with consistent error handling.
 *
 * - Always throws EdgeFunctionError on failure (with best-effort message extraction).
 * - Keeps a single call-site pattern across all dashboard services.
 */
export async function invokeEdgeFunction<TResponse>(
    functionName: string,
    body?: Record<string, unknown>,
): Promise<TResponse> {
    log.debug("invokeEdgeFunction: invoking", { functionName });

    const { data, error } = await supabase.functions.invoke(
        functionName,
        body ? { body } : undefined,
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
 * Optional helper for call-sites that prefer a Result type.
 */
export async function invokeEdgeFunctionSafe<TResponse>(
    functionName: string,
    body?: Record<string, unknown>,
): Promise<InvokeResult<TResponse>> {
    try {
        const data = await invokeEdgeFunction<TResponse>(functionName, body);
        return { data, error: null };
    } catch (e) {
        const err = e instanceof EdgeFunctionError
            ? e
            : await toEdgeFunctionError(e, functionName);
        return { data: null, error: err };
    }
}
