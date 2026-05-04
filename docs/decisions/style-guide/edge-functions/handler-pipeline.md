# Edge handler pipeline (`serveJsonHandler`)

Canonical initiative doc: [`docs/stages/S2-unified-edge-handler-pipeline.md`](../../../stages/S2-unified-edge-handler-pipeline.md).

Auth patterns (`requireAuthenticatedOrgMember`, `gateOrganizationRequest`): [`auth.md`](./auth.md).

---

## Phase 1 scope

Use **`serveJsonHandler`** for **`secured`** and **`public`** handlers that accept a **JSON body** (default **`POST`**).

Do **not** use **`preset: "identity"`** in production yet (returns **501** until Phase 2+).

Legacy **`alternate_auth`**, **`secured_custom`**, most **`identity`** handlers stay manual `serve` until triaged.

Large **`identity`** handlers (**e.g.** [`create-job`](../../../../database/supabase/functions/create-job/index.ts)): prefer **extract-first** into **`handlers/*.ts`** ([`split-handlers.md`](./split-handlers.md)) **before** migrating the HTTP shell — reduces review surface and preserves **`handleCors`** / parity tests.

---

## Usage (`secured`)

```typescript
import { serveJsonHandler } from "../_utils/handler-pipeline.ts";
import { jsonResponse } from "../_utils/http.ts";
import { listFormSectionsBodySchema } from "../_utils/zod-schemas.ts";

serveJsonHandler({
  name: "list-form-sections",
  schema: listFormSectionsBodySchema,
  preset: "secured",
  securedClientMode: "membership", // or "gate" for gateOrganizationRequest
  run: async ({ supabase, auth, correlationId }) => {
    return jsonResponse({ ok: true }, 200, undefined, correlationId);
  },
});
```

- **`auth.organizationId`** matches validated **`organization_id`** from the body.
- Pass **`correlationId`** into **`jsonResponse` / `errorResponse`** when returning manually from **`run`** (pipeline also merges correlation headers when missing).

---

## Usage (`public`)

Same shape with **`preset: "public"`**. **`auth`** is **`undefined`**. Do **not** treat **`Authorization`** as entitlement unless you document extra checks.

---

## Raw body / webhooks / cron

Use **`serveRawHandler`** / **`handleRawRequest`** — single read discipline (`req.text()` only, never **`req.json()`** afterward).

---

## Tests & inventory

- **Pipeline only** (fast): `cd database && deno task test:handler-pipeline`
- **All Edge unit tests** (excludes `*-integration.test.ts` — those need Supabase/network): from repo root run **`pnpm test:edge-unit`**, or `cd database && deno task test:edge-unit`
- **CI:** the **`lint-and-build`** workflow runs **`pnpm validate:functions-inventory`** then **`pnpm test:edge-unit`** (see [`.github/workflows/ci.yml`](../../../../.github/workflows/ci.yml)).
- **`secured`** handlers that only use the pipeline must still satisfy CI: **`functions-inventory`** allows **`serveJsonHandler`** as an org-gate marker when combined with `preset: "secured"` implementation inside **`handler-pipeline.ts`**.

---

## Migration checklist

See [S2 §8](../../../stages/S2-unified-edge-handler-pipeline.md#8-migration-checklist-per-handler--post-phase-1).
