# S2 — Features & Functions: Unified Edge handler pipeline

| Field                | Value                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Stage**            | S2 — Features & Functions (scope lock + acceptance criteria)                                                              |
| **From**             | [S1 — Unified Edge handler pipeline](./S1-unified-edge-handler-pipeline.md) — triage **GO**                               |
| **Created**          | 2026-05-04                                                                                                                |
| **Gold reviewed**    | 2026-05-04 — inventory counts reconciled to `functions-inventory.yaml` **v1**; pilot corrected against runtime source     |
| **Diamond reviewed** | 2026-05-04 — cross-checked live `identity` / `secured_custom` handlers; Phase 1 scope tightened                           |
| **Depends on**       | [S1 — Org authorization](./S1-edge-function-org-authorization-enforcement.md) — Phases **1–4** complete; inventory is law |
| **Product**          | Tally Runner — Supabase Edge Functions                                                                                    |

---

## Diamond review summary

| Dimension        | Finding                                                                                                                                                                                                                                                                                                                                     | Amendment                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accuracy**     | **`identity` inventory (4)** is **not** one auth pattern — e.g. [`get-organization-id`](../../database/supabase/functions/get-organization-id/index.ts) allows optional body email + optional token + multi-strategy org resolution; [`create-job`](../../database/supabase/functions/create-job/index.ts) is JWT gate + large bespoke flow | **`identity` preset is Phase 2+** in implementation; Phase 1 ships **`secured` + `public` (+ `raw` escape hatch)** only. Acceptance tests for `identity` moved to **§6.4 (deferred)**. |
| **Accuracy**     | **`secured_custom` (8)** is mostly **JSON + JWT**, not `req.text()` — e.g. [`admin-create-job`](../../database/supabase/functions/admin-create-job/index.ts)                                                                                                                                                                                | **`raw` preset applies to non-JSON / cron-style bodies**, not to the whole class. **`secured_custom` + `alternate_auth` stay legacy Phase 1** (no forced migration).                   |
| **Completeness** | Rollback and verify commands were implicit                                                                                                                                                                                                                                                                                                  | Added **§13 Rollback** and **§14 Verification commands**.                                                                                                                              |
| **Security**     | `securedClientMode: "gate"` needs explicit **`organization_id`** source                                                                                                                                                                                                                                                                     | Added **§15 Invariants** (body field, membership vs gate).                                                                                                                             |
| **Consistency**  | Typed-JSON count mixed in deferred `identity`                                                                                                                                                                                                                                                                                               | **Phase 1 high-confidence JSON presets:** **`secured` 76 + JSON `public` 8 = 84** handlers.                                                                                            |
| **DX**           | Illustrative `serveJsonHandler` block omitted imports for `serve`, `jsonResponse`                                                                                                                                                                                                                                                           | Clarified as **pseudocode slice**; production module wraps **`serve` from `server`**.                                                                                                  |

---

## Gold review summary

| Finding                                          | Amendment                                                                                                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilot **`list-feedback`** did not match repo     | **Replaced with `list-form-sections`**: actual handler is ~143 LOC with joins; pilot target must match “thin vertical slice” narrative                                                 |
| “Before” snippet used Zod `validateRequest`      | Production **`list-feedback`** / **`list-form-sections`** use **`validateRequiredFields`** today; pilot **introduces** shared Zod body schema (per `_utils/zod-schemas.ts` convention) |
| API sketch implied bare `zod` package            | Edge **`_utils`** use **pinned ESM** (`https://esm.sh/zod@…`) — pipeline module must follow same rule as [`zod-schemas.ts`](../../database/supabase/functions/_utils/zod-schemas.ts)   |
| `alternate_auth` mapped only to `raw`            | **Corrected:** those handlers are typically **JSON + custom JWT/resource binding**, not `req.text()` — Phase 1 keeps them **legacy** until a named preset exists                       |
| **`gateOrganizationRequest`** omitted            | Documented as **implementation option** inside `secured` (bundles service-role client + membership); does not change auth semantics ([S1 G4](./S1-unified-edge-handler-pipeline.md))   |
| **`withIdempotency`** vs `_utils/idempotency.ts` | Marked as **target wrapper API** — implement by composing existing `checkIdempotencyKey` / `storeIdempotencyKey`                                                                       |
| Correlation ID                                   | Pipeline **must** pass `logger.getCorrelationId()` into `jsonResponse` / `errorResponse` (many legacy handlers omit this today)                                                        |

---

## 1. Feature summary

Introduce a **typed, composable handler pipeline** for Edge Functions that **centralizes** CORS, JSON parsing, validation, logging, and authorization into a **single entry point**. New functions use this pipeline by default; legacy handlers migrate incrementally on touch.

---

## 2. Preset matrix

Presets map to **`functions-inventory.yaml` classes**. Each preset enforces a **fixed sequence**; handlers supply **business logic** inside `run`.

| Preset                      | Inventory classes                                                                                                                 | Auth                                                                                                                                                                   | Body                                                 | Example functions                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| **`secured`**               | `secured`                                                                                                                         | JWT + org membership (`requireAuthenticatedOrgMember`, or **`gateOrganizationRequest`** when handler wants one bundled client)                                         | JSON (Zod schema)                                    | `list-workers`, `list-form-sections`, `create-invoice`                      |
| **`public`**                | `public` callers that use **JSON POST bodies** (8 of 9 `public`)                                                                  | None                                                                                                                                                                   | JSON (Zod schema)                                    | `submit-feedback`, `get-job-by-token`, `accept-worker-invitation`           |
| **`raw`**                   | `privileged_batch`; **`public`** callers needing raw body (`stripe-webhook`); any handler that **cannot** use single `req.json()` | **Caller-managed**                                                                                                                                                     | Raw bytes (`req.text()` / `req.arrayBuffer()`, etc.) | `stripe-webhook`, `auto-generate-invoices`                                  |
| **`identity`** _(Phase 2+)_ | `identity`                                                                                                                        | **No single preset yet** — handlers mix JWT-only, optional body, org inference (`getOrganizationIdFromAdmin` / `getOrganizationIdFromWorker`), and large orchestration | JSON varies                                          | `get-organization-id`, `get-user-role`, `get-onboarding-data`, `create-job` |

### Classes outside Phase 1 migration (inventory unchanged)

| Inventory class      | Count | Treatment in Phase 1                                                                                                   |
| -------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| **`identity`**       | 4     | **Legacy scaffold** — design **`identity-*` preset family** in **S3** (do not force-fit one `serveJsonHandler` shape). |
| **`alternate_auth`** | 2     | **Legacy** — JSON + resource-bound auth (`get-job-edits`, `list-pending-confirmations`).                               |
| **`secured_custom`** | 8     | **Legacy** — typically JSON + bespoke auth; **not** `raw` by default. Migrate case-by-case later.                      |
| All others           | —     | Use **`secured`**, **`public`**, or **`raw`** per rows above.                                                          |

### Preset coverage (machine-checked)

Counts from [`functions-inventory.yaml`](../../database/supabase/functions/functions-inventory.yaml) **v1**:

| Inventory class    | Count | Primary preset                                |
| ------------------ | ----- | --------------------------------------------- |
| `secured`          | 76    | `secured`                                     |
| `public`           | 9     | `public` **or** `raw` (e.g. `stripe-webhook`) |
| `identity`         | 4     | **Legacy Phase 1** (preset designed in S3)    |
| `privileged_batch` | 4     | `raw`                                         |
| `alternate_auth`   | 2     | Legacy (see above)                            |
| `secured_custom`   | 8     | Legacy (see above)                            |

**Total functions:** 103.

**S1 criterion (“≥95%”):** **Every handler has a documented lane:** **`secured`**, **`public`**, **`raw`**, or **Phase 1 legacy exemption** (`identity`, `alternate_auth`, `secured_custom`) — **103 / 103**.

**Phase 1 implemented presets (reference + pilot):** **`secured`** + **`public`** (+ **`raw`** module stub if Phase 1b includes webhook spike). **High-confidence JSON migrations:** **`secured` 76 + JSON `public` 8 = 84**. Remaining **19** = `stripe-webhook` (1) + `privileged_batch` (4) + `identity` (4) + `alternate_auth` (2) + `secured_custom` (8).

**Note:** The **`HandlerPreset`** type may still list `"identity"` for forward API compatibility, but **Phase 1 code paths must not claim production readiness** for that preset until S3 defines behavior per handler family.

---

## 3. API specification

### Implementation constraints (repo-specific)

- Import **`z`** the same way as [`_utils/zod-schemas.ts`](../../database/supabase/functions/_utils/zod-schemas.ts) (pinned `esm.sh` URL) so Deno resolves consistently across function bundles.
- Logger type: use **`ReturnType<typeof createLogger>`** ( [`logger.ts`](../../database/supabase/functions/_utils/logger.ts) does not export `EdgeFunctionLogger`).

### 3.1 Primary API: `serveJsonHandler`

**Phase 1 delivery:** Implement **`preset: "secured"`** and **`preset: "public"`** only. **`"identity"`** remains a **reserved** discriminator until **S3** specifies per-handler contracts (see Diamond summary).

Illustrative signature (production module also **`import { serve } from "server"`** and wrap the inner handler):

```typescript
// _utils/handler-pipeline.ts (conceptual — full module adds serve() wiring)

import type { SupabaseClient } from "@supabase/supabase-js";
import { z, type ZodTypeAny } from "https://esm.sh/zod@3.23.8";
import { createLogger } from "./logger.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/** Presets for JSON handlers — align naming with inventory semantics */
export type HandlerPreset = "secured" | "public" | "identity"; // "identity": Phase 2+ only

export interface SecuredAuth {
  userId: string;
  userEmail: string | null;
  /** Canonical org for this request — from validated body or preset-specific extract */
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
  /** Allowed HTTP methods for this JSON preset; default `["POST"]` */
  methods?: string[];
  /**
   * When `preset === "secured"`:
   * - `"membership"` — `createServiceRoleClient` + `requireAuthenticatedOrgMember` (majority)
   * - `"gate"` — `gateOrganizationRequest(req, organizationId, logger)` and reuse returned client
   */
  securedClientMode?: "membership" | "gate";
  run: (ctx: HandlerContext<z.infer<TSchema>, P>) => Promise<Response>;
}

export function serveJsonHandler<TSchema extends ZodTypeAny, P extends HandlerPreset>(
  options: JsonHandlerOptions<TSchema, P>
): void;
```

**Response helpers:** The adapter around `run()` **must** attach `correlationId` to success and error responses via existing [`jsonResponse` / `errorResponse`](../../database/supabase/functions/_utils/http.ts) optional argument — fixes inconsistent legacy behavior.

### 3.2 Escape hatch: `serveRawHandler`

```typescript
type EdgeLogger = ReturnType<typeof createLogger>; // createLogger from ./logger.ts

export interface RawHandlerOptions {
  name: string;
  cors?: boolean;
  /** Optional — batch/custom handlers often need service role */
  withServiceRole?: boolean;
  run: (ctx: {
    req: Request;
    logger: EdgeLogger;
    correlationId: string;
    supabase?: SupabaseClient;
  }) => Promise<Response>;
}

export function serveRawHandler(options: RawHandlerOptions): void;
```

### 3.3 Optional layer: `withIdempotency` (target)

**Status:** Conceptual API — implement using [`_utils/idempotency.ts`](../../database/supabase/functions/_utils/idempotency.ts) (`checkIdempotencyKey`, `storeIdempotencyKey`). No production handler imports idempotency helpers yet; keep opt-in only.

```typescript
export function withIdempotency(
  req: Request,
  correlationId: string,
  handler: () => Promise<Response>
): Promise<Response>;
```

---

## 4. Pipeline stages (internal)

Order **must** match security intent: **no body read before CORS short-circuit**; **no business logic before auth** for `secured` / `identity`.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CORS (OPTIONS → return early)                                │
├─────────────────────────────────────────────────────────────────┤
│ 2. Logger + correlation ID (`createLogger` / `getCorrelationId`)│
├─────────────────────────────────────────────────────────────────┤
│ 3. HTTP method guard (default POST for JSON presets; override OK)│
├─────────────────────────────────────────────────────────────────┤
│ 4. Parse JSON body (single read)                                │
├─────────────────────────────────────────────────────────────────┤
│ 5. Validate with Zod → typed body or 400 (Problem Details)      │
├─────────────────────────────────────────────────────────────────┤
│ 6. Auth gate (preset-driven)                                     │
│    • secured  → membership or gateOrganizationRequest           │
│    • public   → skip                                            │
│    • identity → **Phase 2+** (not implemented in Phase 1)      │
├─────────────────────────────────────────────────────────────────┤
│ 7. Service-role Supabase client (unless gate already returned one)│
├─────────────────────────────────────────────────────────────────┤
│ 8. `run(ctx)` — business logic                                  │
├─────────────────────────────────────────────────────────────────┤
│ 9. Catch → `logger.error` + `errorResponse(..., correlationId)` │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Pilot function

**Chosen:** **`list-form-sections`** ([`index.ts`](../../database/supabase/functions/list-form-sections/index.ts))

| Criterion               | Value                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Inventory class         | `secured`                                                                                                                          |
| Current size            | ~60 LOC                                                                                                                            |
| Validation today        | `validateRequiredFields(body, ["organization_id"])` ([deprecated pattern](../../database/supabase/functions/_utils/validation.ts)) |
| Business logic          | Single `form_section` query ordered by `order_position`                                                                            |
| Regression blast radius | Narrow — dashboard form-builder reads                                                                                              |

**Not chosen:** `list-feedback` — multi-query assembly (~143 LOC); fine as **second** migration after pipeline proves out, misleading as first pilot.

### Pilot body schema

Add (or reuse) a minimal Zod object in `_utils/zod-schemas.ts`, e.g. `listFormSectionsBodySchema = z.object({ organization_id: uuidSchema })`, and pass it to `serveJsonHandler`.

### Before (current — abbreviated)

Matches repo: CORS → logger → `req.json()` → `validateRequiredFields` → `requireAuthenticatedOrgMember` → query → `jsonResponse` / `errorResponse`.

### After (pipeline — illustrative)

```typescript
serveJsonHandler({
  name: "list-form-sections",
  schema: listFormSectionsBodySchema,
  preset: "secured",
  securedClientMode: "membership",
  run: async ({ supabase, auth, logger, correlationId }) => {
    const { data: sections, error } = await supabase
      .from("form_section")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .order("order_position", { ascending: true });

    if (error) throw error;

    return jsonResponse({ success: true, sections: sections || [] }, 200, undefined, correlationId);
  },
});
```

**LOC reduction:** boilerplate only (~25 lines of structural code), not total file size — business logic stays stable.

---

## 6. Acceptance tests

### 6.1 Pipeline unit tests (`_utils/__tests__/handler-pipeline.test.ts`)

| Test                                                                  | Assertion                                                                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| OPTIONS → 200 + CORS headers                                          | Preflight short-circuit                                                                                                                          |
| Disallowed HTTP method → 405                                          | Default `POST`; optional `methods` allow listed verbs                                                                                            |
| Empty body → 400                                                      | Treated as invalid JSON                                                                                                                          |
| Malformed JSON → 400                                                  | Parse failure                                                                                                                                    |
| Zod failure → 400 + structured error body                             | Prefer Problem Details (`detail`) where mapped from [`validateRequest`](../../database/supabase/functions/_utils/zod-schemas.ts) / schema issues |
| `secured` + missing `Authorization` → 401                             | Matches `requireAuthenticatedOrgMember`                                                                                                          |
| `secured` + wrong org → 403                                           | Membership denial                                                                                                                                |
| `secured` + `securedClientMode: "gate"`                               | Uses injected `gateOrganizationRequest`; success uses gated Supabase client                                                                      |
| `secured` + valid → `run` invoked; `auth.organizationId` matches body | Context correctness                                                                                                                              |
| `public` + no auth → `run` invoked; `auth` undefined                  | Preset semantics                                                                                                                                 |
| `identity` preset (stub)                                              | Returns **501**; unit-tested — full **`identity`** handler migrations **deferred** — §6.4                                                        |
| Uncaught throw in JSON handler → 500 + structured error               | Logged via `logger.error`; correlation header                                                                                                    |
| `handleRawRequest`: default OPTIONS                                   | CORS short-circuit (`ok`)                                                                                                                        |
| `handleRawRequest` + `cors: false` + OPTIONS                          | Preflight does **not** short-circuit; `run` executes                                                                                             |
| `handleRawRequest` throw → 500                                        | Problem Details–style body; `x-correlation-id` preserved                                                                                         |
| Success + error responses include `x-correlation-id`                  | Merged on responses when missing                                                                                                                 |

### 6.2 Pilot verification

| Check                       | Method                                                   |
| --------------------------- | -------------------------------------------------------- |
| Same JSON shape for success | Diff staging responses before/after (same auth fixtures) |
| 401 / 403 parity            | Reuse org-auth test patterns where applicable            |
| Dashboard form sections UI  | Manual or E2E smoke if coverage exists                   |

### 6.3 Non-regression (CI)

- Root **`pnpm`** test/lint pipeline green (dashboard unchanged unless imports invoke renamed exports — not expected for pilot).
- **`pnpm validate:functions-inventory`** unchanged classification for `list-form-sections`.
- **`pnpm test:edge-unit`** green — runs all Edge **`**tests**/**/_.test.ts`** under [`database/supabase/functions`](../../database/supabase/functions) **except** `_-integration.test.ts` (integration stays manual / secrets-backed). Executed in **`lint-and-build`** (`.github/workflows/ci.yml`).

### 6.4 Deferred (Phase 2+): `identity` preset

Do **not** block Phase 1 on these — capture when designing **S3**:

| Handler                                                                                 | Why `identity` is not one-size-fits-all                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`get-organization-id`](../../database/supabase/functions/get-organization-id/index.ts) | Optional JSON email; token optional in some paths; admin vs worker org resolution             |
| [`get-user-role`](../../database/supabase/functions/get-user-role/index.ts)             | JWT required; optional `organization_id` in body; org inferred if omitted                     |
| [`get-onboarding-data`](../../database/supabase/functions/get-onboarding-data/index.ts) | JWT + org inferred from admin then worker                                                     |
| [`create-job`](../../database/supabase/functions/create-job/index.ts)                   | JWT gate + large orchestration — pipeline wrapper is cosmetic unless split into modules first |

### 6.5 Deferred: `public` GET / query-string handlers

Phase 1 assumes **JSON POST** for `serveJsonHandler`. If any **`public`** caller uses **GET + query params** only, it stays **legacy** until the pipeline grows **`parseJsonOrQuery`** or similar (**S3**).

---

## 7. File manifest

| Path                                                                    | Description                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `database/supabase/functions/_utils/handler-pipeline.ts`                | Core: `serveJsonHandler`, `serveRawHandler`, types                                |
| `database/supabase/functions/_utils/__tests__/handler-pipeline.test.ts` | Unit tests                                                                        |
| `database/supabase/functions/_utils/zod-schemas.ts`                     | Add `listFormSectionsBodySchema` (or equivalent)                                  |
| `database/supabase/functions/list-form-sections/index.ts`               | Pilot migration                                                                   |
| `docs/decisions/style-guide/edge-functions/handler-pipeline.md`         | Usage + migration checklist ([S1 Phase 3](./S1-unified-edge-handler-pipeline.md)) |

---

## 8. Migration checklist (per handler — post-Phase 1)

```
Function: ____________________

Pre-migration:
[ ] Inventory class → preset (**identity / alternate_auth / secured_custom → stop**; plan separately — [S2 §2](./S2-unified-edge-handler-pipeline.md#2-preset-matrix))
[ ] Confirm auth ordering safe (no logic before gate that trusted unauthenticated input)
[ ] Add or reuse Zod body schema in zod-schemas.ts

Migration:
[ ] Replace manual serve boilerplate with serveJsonHandler / serveRawHandler
[ ] Move logic into run(ctx)
[ ] Pass correlationId into jsonResponse / errorResponse (pipeline default)

Post-migration:
[ ] `pnpm test:edge-unit` green (or `cd database && deno task test:edge-unit`)
[ ] Staging smoke
[ ] validate:functions-inventory
```

---

## 9. Risks & mitigations (refined)

| Risk                                        | Mitigation                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Assuming **`identity`** is one preset       | **Diamond finding:** deferred to **§6.4** / **S3** — do not implement `identity` branch in Phase 1 |
| **`secured_custom`** mistaken for **`raw`** | Class remains legacy JSON (**§2**) — code review + inventory literacy                              |
| Pilot regression                            | Staging diff; feature flag optional (usually unnecessary for read-only list)                       |
| Zod vs legacy validation drift              | Pilot uses strict UUID schema — aligns with security posture                                       |
| `securedClientMode` misuse                  | Code review + preset docs; default `membership`                                                    |
| Contributors bypass pipeline                | PR checklist + optional lint warning ([S1 Phase 3](./S1-unified-edge-handler-pipeline.md))         |

---

## 10. Out of scope (S2 lock)

- RLS / service-role reduction
- `verify_jwt = true` flip ([org-auth G5](./S1-edge-function-org-authorization-enforcement.md))
- Deno lint blanket fixes (`continue-on-error`, etc.)
- Mechanical codemod of all 103 handlers
- Changing **`functions-inventory.yaml`** classification semantics
- **`identity`** preset **production behavior** in Phase 1 (reserved type only — **§6.4**)
- **`alternate_auth`** / **`secured_custom`** preset design (defer to **S3**)

---

## 11. Dependencies

| Dependency              | Source                          | Notes                                            |
| ----------------------- | ------------------------------- | ------------------------------------------------ |
| Zod                     | `https://esm.sh/zod@3.23.8`     | Same pin strategy as `zod-schemas.ts`            |
| `@supabase/supabase-js` | Existing import map             | Service-role client                              |
| `server`                | `deno.json` (`std/http/server`) | `serve` primitive — pipeline calls it internally |

No new packages beyond the pinned Zod URL already used in `_utils`.

---

## 12. Summary

| Item                       | Outcome                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 scope**          | **`serveJsonHandler`**: implement **`secured`** + **`public`** only; **`identity`** reserved / deferred (**§6.4**); **`serveRawHandler`** optional per [S1 Phase 2](./S1-unified-edge-handler-pipeline.md) |
| **Legacy (Phase 1)**       | **`identity`**, **`alternate_auth`**, **`secured_custom`** — no forced migration (**§2**)                                                                                                                  |
| **Pilot**                  | **`list-form-sections`** + `listFormSectionsBodySchema`                                                                                                                                                    |
| **Secured implementation** | Default **`membership`**; optional **`gate`** (**§15 I2**)                                                                                                                                                 |
| **Observability**          | Correlation ID on all pipeline-emitted responses                                                                                                                                                           |
| **Tests**                  | §6.1–6.3 + **§14** commands                                                                                                                                                                                |

---

## 12a. Estimated effort & PR plan

| PR                       | Scope                                                                         | Files | Complexity                       |
| ------------------------ | ----------------------------------------------------------------------------- | ----- | -------------------------------- |
| **PR 1** — Core pipeline | `handler-pipeline.ts` + unit tests                                            | 2     | Medium — ~200–300 LOC new module |
| **PR 2** — Pilot + docs  | `list-form-sections` migration, `listFormSectionsBodySchema`, style guide doc | 3–4   | Low — refactor + docs            |

**Total:** ~2 PRs, ~1–2 days implementation + review.

**Sequencing:**

1. **PR 1:** Create `_utils/handler-pipeline.ts` with `serveJsonHandler` (`secured` + `public`), `serveRawHandler` stub, types. Add `_utils/__tests__/handler-pipeline.test.ts` with §6.1 tests.
2. **PR 2:** Add `listFormSectionsBodySchema` to `zod-schemas.ts`. Migrate `list-form-sections/index.ts`. Create `docs/decisions/style-guide/edge-functions/handler-pipeline.md`. Verify §14 commands pass.
3. **Adopt-on-touch:** Future PRs touching `secured` handlers migrate opportunistically.

---

## 13. Rollback

| Scenario                   | Action                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilot defect in production | Revert the **`list-form-sections`** migration commit (restore manual `serve`); `_utils/handler-pipeline.ts` may remain if no handler imports it |
| Pipeline utility buggy     | Single PR rollback — feature flags not required for pilot                                                                                       |
| Inventory CI regression    | Classification unchanged for pilot; fix imports / validator before merge                                                                        |

**Rollback proof:** Git history retains pre-migration handler; optional staging tag.

---

## 14. Verification commands

| Step                                                        | Command (repo root unless noted)                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Inventory reconciliation                                    | `pnpm validate:functions-inventory`                                                                          |
| Edge Functions unit suite (CI parity; excludes integration) | `pnpm test:edge-unit`                                                                                        |
| Pipeline unit tests only                                    | `cd database && deno task test:handler-pipeline`                                                             |
| Existing org-member tests                                   | `cd database && deno test --allow-all supabase/functions/__tests__/require-authenticated-org-member.test.ts` |
| Dashboard regression                                        | `pnpm test` (from repo root; scope per CI)                                                                   |

**`database/deno.json` tasks:** [`test:edge-unit`](../../database/deno.json) matches CI’s filtered suite; [`tasks.test`](../../database/deno.json) includes `*-integration.test.ts` and requires Supabase/network for those modules — use **`test:integration`** intentionally when testing against a live project.

---

## 15. Implementation invariants

| ID  | Invariant                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | **`secured`**: validate **`organization_id`** with Zod **before** membership; **`auth.organizationId`** === body **`organization_id`**.                                      |
| I2  | **`securedClientMode: "gate"`**: **`gateOrganizationRequest(req, organizationId, logger)`** — **`organizationId`** only from Zod-validated body.                             |
| I3  | **`public`**: do not treat **`Authorization`** as proof of entitlement inside **`run`** unless explicitly documented.                                                        |
| I4  | **Single body read:** **`serveJsonHandler`** reads the body once via **`req.text()`** then **`JSON.parse`**; **`serveRawHandler`** callers must not mix multiple body reads. |
| I5  | **CORS:** match legacy [**`CORS_HEADERS`**](../../database/supabase/functions/_utils/http.ts).                                                                               |

---

---

## 16. S3 decision

| Option                  | Rationale                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skip S3 → Implement** | Phase 1 scope is **2 PRs / 4–5 files**. PR plan in **§12a** covers sequencing. Overhead of formal S3 outweighs value for this size.                               |
| Defer S3 to Phase 2+    | **`identity` preset family**, **`alternate_auth`**, **`secured_custom`** need design work — capture in **future S3** when pipeline proves out and adoption > 50%. |

**Recommendation:** **Implement Phase 1 directly** per §12a. Create **S3** only if Phase 2+ scope expands (e.g., `identity` family, codemod).
