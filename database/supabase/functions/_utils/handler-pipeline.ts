/**
 * Unified JSON handler pipeline for Edge Functions (Phase 1: `secured` + `public`).
 * See docs/stages/S2-unified-edge-handler-pipeline.md.
 */
// deno-lint-ignore-file no-import-prefix
import { serve } from "server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z, type ZodTypeAny } from "https://esm.sh/zod@3.23.8";
import { gateOrganizationRequest } from "./gate-organization-request.ts";
import { errorResponse, handleCors } from "./http.ts";
import { createLogger } from "./logger.ts";
import {
  type AuthenticatedOrgMemberResult,
  requireAuthenticatedOrgMember,
} from "./require-authenticated-org-member.ts";
import { createServiceRoleClient } from "./supabase.ts";
import { validateRequest } from "./zod-schemas.ts";

export type HandlerPreset = "secured" | "public" | "identity";

export interface SecuredAuth {
  userId: string;
  userEmail: string | null;
  organizationId: string;
}

export interface IdentityAuth {
  userId: string;
  userEmail: string | null;
}

export type AuthContext<P extends HandlerPreset> = P extends "secured"
  ? SecuredAuth
  : P extends "identity"
    ? IdentityAuth
    : undefined;

export type EdgeLogger = ReturnType<typeof createLogger>;

export interface HandlerContext<TBody, P extends HandlerPreset> {
  req: Request;
  body: TBody;
  logger: EdgeLogger;
  correlationId: string;
  supabase: SupabaseClient;
  auth: AuthContext<P>;
}

export interface JsonHandlerOptions<TSchema extends ZodTypeAny, P extends HandlerPreset> {
  name: string;
  schema: TSchema;
  preset: P;
  methods?: string[];
  securedClientMode?: "membership" | "gate";
  run: (ctx: HandlerContext<z.infer<TSchema>, P>) => Promise<Response>;
}

export type JsonPipelineDeps = {
  createServiceRoleClient?: () => SupabaseClient;
  requireAuthenticatedOrgMember?: (
    req: Request,
    organizationId: string,
    supabase: SupabaseClient
  ) => Promise<AuthenticatedOrgMemberResult>;
  gateOrganizationRequest?: typeof gateOrganizationRequest;
};

function mergeCorrelationId(response: Response, correlationId: string): Response {
  if (!correlationId) return response;
  const headers = new Headers(response.headers);
  if (!headers.has("x-correlation-id")) {
    headers.set("x-correlation-id", correlationId);
  }
  return new Response(response.body, { status: response.status, headers });
}

function extractOrganizationId(body: unknown): string | null {
  if (body && typeof body === "object" && "organization_id" in body) {
    const v = (body as { organization_id: unknown }).organization_id;
    return typeof v === "string" ? v : null;
  }
  return null;
}

export async function handleJsonRequest<TSchema extends ZodTypeAny, P extends HandlerPreset>(
  req: Request,
  options: JsonHandlerOptions<TSchema, P>,
  deps?: JsonPipelineDeps
): Promise<Response> {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: options.name });
  const correlationId = logger.getCorrelationId();

  const methods = options.methods ?? ["POST"];
  if (!methods.includes(req.method)) {
    return errorResponse("Method not allowed", 405, undefined, correlationId);
  }

  const createClient = deps?.createServiceRoleClient ?? createServiceRoleClient;

  let parsedBody: unknown;
  try {
    const text = await req.text();
    if (!text.trim()) {
      return errorResponse("Invalid JSON body", 400, undefined, correlationId);
    }
    parsedBody = JSON.parse(text);
  } catch {
    return errorResponse("Invalid JSON body", 400, undefined, correlationId);
  }

  const validation = validateRequest(options.schema, parsedBody);
  if (!validation.success) {
    return errorResponse(validation.error, 400, undefined, correlationId);
  }

  const body = validation.data;

  if (options.preset === "identity") {
    return errorResponse(
      "identity preset is not implemented (Phase 2+)",
      501,
      undefined,
      correlationId
    );
  }

  try {
    const supabase = createClient();

    if (options.preset === "public") {
      const ctx = {
        req,
        body,
        logger,
        correlationId,
        supabase,
        auth: undefined as AuthContext<P>,
      } as HandlerContext<z.infer<TSchema>, P>;
      const response = await options.run(ctx);
      return mergeCorrelationId(response, correlationId);
    }

    if (options.preset !== "secured") {
      return errorResponse("Unsupported preset", 500, undefined, correlationId);
    }

    const organizationId = extractOrganizationId(body);
    if (!organizationId) {
      return errorResponse("Organization ID is required", 400, undefined, correlationId);
    }

    const requireMember = deps?.requireAuthenticatedOrgMember ?? requireAuthenticatedOrgMember;
    const gateFn = deps?.gateOrganizationRequest ?? gateOrganizationRequest;

    const mode = options.securedClientMode ?? "membership";

    if (mode === "gate") {
      const gated = await gateFn(req, organizationId, logger);
      if (!gated.ok) {
        return mergeCorrelationId(gated.response, correlationId);
      }
      const auth: SecuredAuth = {
        userId: gated.ctx.userId,
        userEmail: gated.ctx.userEmail,
        organizationId,
      };
      const ctx = {
        req,
        body,
        logger,
        correlationId,
        supabase: gated.ctx.supabase,
        auth,
      } as HandlerContext<z.infer<TSchema>, P>;
      const response = await options.run(ctx);
      return mergeCorrelationId(response, correlationId);
    }

    const gate = await requireMember(req, organizationId, supabase);
    if (!gate.ok) {
      if (gate.response.status === 403) {
        logger.warn("Unauthorized organization access attempt", {
          organization_id: organizationId,
        });
      }
      return mergeCorrelationId(gate.response, correlationId);
    }

    const auth: SecuredAuth = {
      userId: gate.userId,
      userEmail: gate.userEmail,
      organizationId,
    };

    const ctx = {
      req,
      body,
      logger,
      correlationId,
      supabase,
      auth,
    } as HandlerContext<z.infer<TSchema>, P>;

    const response = await options.run(ctx);
    return mergeCorrelationId(response, correlationId);
  } catch (error) {
    logger.error(`${options.name} error`, error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500, undefined, correlationId);
  }
}

export function serveJsonHandler<TSchema extends ZodTypeAny, P extends HandlerPreset>(
  options: JsonHandlerOptions<TSchema, P>,
  deps?: JsonPipelineDeps
): void {
  serve((req) => handleJsonRequest(req, options, deps));
}

export interface RawHandlerOptions {
  name: string;
  /** When `false`, skip automatic CORS preflight handling. Default: handle CORS. */
  cors?: boolean;
  withServiceRole?: boolean;
  run: (ctx: {
    req: Request;
    logger: EdgeLogger;
    correlationId: string;
    supabase?: SupabaseClient;
  }) => Promise<Response>;
}

export type RawPipelineDeps = {
  createServiceRoleClient?: () => SupabaseClient;
};

export async function handleRawRequest(
  req: Request,
  options: RawHandlerOptions,
  deps?: RawPipelineDeps
): Promise<Response> {
  const skipCors = options.cors === false;
  if (!skipCors) {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;
  }

  const logger = createLogger(req, { functionName: options.name });
  const correlationId = logger.getCorrelationId();
  const createClient = deps?.createServiceRoleClient ?? createServiceRoleClient;

  try {
    let supabase: SupabaseClient | undefined;
    if (options.withServiceRole) {
      supabase = createClient();
    }
    const response = await options.run({ req, logger, correlationId, supabase });
    return mergeCorrelationId(response, correlationId);
  } catch (error) {
    logger.error(`${options.name} raw handler error`, error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500, undefined, correlationId);
  }
}

export function serveRawHandler(options: RawHandlerOptions, deps?: RawPipelineDeps): void {
  serve((req) => handleRawRequest(req, options, deps));
}
