# S1 — Triage: Unified Edge handler pipeline

| Field             | Value                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**         | S1 — Triage (feasibility, risk, scope lock, phased delivery outline)                                                                                                                      |
| **From**          | [S0 — Unified Edge handler pipeline](./S0-unified-edge-handler-pipeline.md) (intake **promoted** 2026-05-04)                                                                              |
| **Triaged**       | 2026-05-04                                                                                                                                                                                |
| **Depends on**    | [S1 — Edge Function org authorization](./S1-edge-function-org-authorization-enforcement.md) — Phases **1–4** **complete**; **`functions-inventory.yaml`** is authoritative classification |
| **Product**       | Tally Runner — Supabase Edge Functions (dashboard + mobile API layer)                                                                                                                     |
| **Risk / reward** | **Medium engineering risk**, **high maintainability reward** — refactors touch **103** entrypoints if pursued broadly                                                                     |

---

## 1. Locked intent (from S0 — unchanged meaning)

Handlers today repeat an **informal pipeline**: `serve` → **`handleCors`** → JSON parse → validation → **org gate** (when applicable) → **`createServiceRoleClient`** → business logic → **`jsonResponse` / `errorResponse`** + **`createLogger`**. Documentation exists (style guide, archived phase-4 patterns) but **structure is not enforced in code**.

**Goal:** Introduce a **unified handler pipeline** (composable steps or wrapper) so CORS, parsing, validation, logging, authz **hooks**, and error shaping follow **one typed contract**. New functions plug logic into the pipeline instead of copying boilerplate.

**Explicit non-goal:** Replace **`functions-inventory.yaml`** classifications or redefine **who** may invoke each function — that remains the **[org-authorization S1](./S1-edge-function-org-authorization-enforcement.md)** outcome.

---

## 2. Problem / opportunity (summary)

| Pain                                                                                                             | Opportunity                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Copy-paste drift in ordering (validate vs gate vs client)                                                        | Single skeleton / presets aligned with inventory classes |
| `withCorsAndErrorHandling` deprecated but unused pattern                                                         | One blessed error + CORS path                            |
| Inconsistent logger / correlation                                                                                | Central observability hooks                              |
| Two structural shapes (`gateOrganizationRequest` vs `createServiceRoleClient` + `requireAuthenticatedOrgMember`) | Presets document **when** each applies                   |

---

## 3. Success criteria (S1-level — measurable later in S2/S5)

| #   | Criterion                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Preset matrix** covers **103 / 103** handlers with explicit lanes (**including** legacy exemptions — see [S2 §2](./S2-unified-edge-handler-pipeline.md#2-preset-matrix)).                  |
| S2  | **Reference implementation** merged (`_utils` module); **at least one** handler migrated (**legacy pilot acceptable** — see [S2 §5](./S2-unified-edge-handler-pipeline.md#5-pilot-function)) |
| S3  | **Migration strategy** chosen (adopt-on-touch vs epic) + rollback story.                                                                                                                     |
| S4  | **Tests:** pipeline unit tests + smoke per preset; no regressions on Tier 1 list/read paths.                                                                                                 |

---

## 4. Strategic gates (decisions — triage lock)

| Gate                                                                         | Decision            | Notes                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 — Pursue unified pipeline**                                             | **GO**              | Maintenance and regression resistance justify work; scope phased                                                                                                    |
| **G2 — Inventory alignment**                                                 | **LOCK**            | Every preset **maps to** `functions-inventory.yaml` classes (`public`, `secured`, `secured_custom`, …) — no preset “opens” org data without matching classification |
| **G3 — Big-bang migrate all 103**                                            | **NO-GO at triage** | Default **adopt-on-touch** + **new functions only** unless S2 proves low-risk mechanical codemod                                                                    |
| **G4 — Replace `gateOrganizationRequest` / `requireAuthenticatedOrgMember`** | **NO-GO**           | Pipeline **wraps** existing gates; changing auth semantics is **out of scope** unless raised as separate security gate                                              |
| **G5 — Block on `verify_jwt` flip**                                          | **NO**              | Pipeline useful regardless; integrate **`verify_jwt`** strategy via **[org-auth G5](./S1-edge-function-org-authorization-enforcement.md)** later                    |

---

## 5. Design directions — **recommendation locked**

| ID  | Direction            | Summary                                                                        | **Decision**                                                                                                                                                                    |
| --- | -------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Higher-order `serve` | `serveJsonHandler({ name, schema, preset, run })` — concise; risk for non-JSON | **GO** — default path for high-volume JSON handlers (**Phase 1:** **`secured` + `public`** only per [S2 diamond](./S2-unified-edge-handler-pipeline.md#diamond-review-summary)) |
| B   | Step composer        | `pipe(cors, parseJson, validate, gatePreset, run)` — flexible                  | **GO** — escape hatch for `public` non-JSON (webhooks), `privileged_batch`, custom patterns                                                                                     |
| C   | Incremental adoption | New + adopt-on-touch only                                                      | **GO** — mandatory for greenfield; migrate legacy on touch                                                                                                                      |
| D   | Mechanical codemod   | Full rewrite — only if harness proves safety                                   | **NO-GO** at triage — revisit if adoption reaches 50%+ voluntarily                                                                                                              |

**S1 lock:** Pursue **A** as the primary API; provide **B** for outliers; adopt incrementally (**C**). Mechanical codemod (**D**) is **deferred**.

### Hard cases (must appear in S2 F&F)

- Non-JSON bodies (Stripe webhook, raw text)
- `privileged_batch` — no org gate at gateway
- `Request` body single-read discipline

---

## 6. Phased delivery (outline — detail in S2/HLP)

| Phase                          | Scope                                                                                                                                                                                                                                                   | Exit criteria                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **1 — Core + pilot**           | `_utils/handler-pipeline.ts` (`serveJsonHandler`, `HandlerContext`); **one** pilot function migrated (recommend: **`list-form-sections`** — ~60 LOC, single-table read, `secured`; see [S2 §5](./S2-unified-edge-handler-pipeline.md#5-pilot-function)) | Unit tests pass; pilot deployed to staging; no behavioral diff                    |
| **2 — Presets + escape hatch** | Define presets for `secured`, `public`, `identity`; add `serveRawHandler` for webhooks / `privileged_batch`                                                                                                                                             | Matrix doc; `stripe-webhook` or one batch job uses escape hatch; CI grep optional |
| **3 — Adoption policy**        | Style guide updated; PR template checkbox; lint rule (warning) for new `serve()` without pipeline import                                                                                                                                                | All new functions use pipeline; 3+ legacy handlers migrated on touch              |
| **4 — Voluntary mass-migrate** | Measure adoption %; if >50% migrated, consider codemod                                                                                                                                                                                                  | Optional; revisit quarterly                                                       |

---

## 7. Risks & mitigations

| Risk                                                  | Mitigation                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Hidden body reads / double-parse                      | Document stage contract; integration tests                       |
| Webhook breakage                                      | Separate preset; never force JSON-only wrapper                   |
| Contributor confusion (two patterns during migration) | Lint comment / deprecation notice on old scaffold in style guide |
| Overfitting to dashboard POST JSON                    | Inventory-driven presets                                         |

---

## 8. Open questions — recommendations

| #   | Question                          | **Recommendation**                                                                                                                                                                                                                                       | Rationale                                                                                             |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | **Context type**                  | `HandlerContext<TBody, TAuth>` — generics narrow `validatedBody: TBody` and auth shape (`{ userId, userEmail, organizationId? }` when `secured`; `undefined` when `public`). Preset picks auth shape automatically. Logger + correlation always present. | Enables type-safe access without casting; preset-driven narrows compile-time guarantees.              |
| 2   | **Deno lint `continue-on-error`** | **Separate track.** Pipeline work does not depend on lint fixes; bundle would delay both.                                                                                                                                                                | Lint is orthogonal; existing handlers violate lint rules unrelated to pipeline (e.g. `prefer-const`). |
| 3   | **Correlation ID**                | **Use existing `getCorrelationId(req)`** (reads `x-correlation-id` / `x-request-id` header or generates). Pipeline sets `logger.correlationId` on context; response includes header via `jsonResponse(..., correlationId)`.                              | Already implemented in `_utils/logger.ts`; no new behavior.                                           |
| 4   | **Idempotency**                   | **Optional preset layer** (`withIdempotency`); **not** baked into core pipeline. Handlers opt-in explicitly. Currently **no** production handlers use it (defined in `_utils/idempotency.ts` but not imported).                                          | Idempotency requires DB table + extra network round-trip; read-only list endpoints don't need it.     |

---

## 9. Out of scope (S1 lock)

- RLS / service-role reduction
- Changing **`organization_id`**-in-body policy
- **[G8](./S1-edge-function-org-authorization-enforcement.md)** batch HTTP hardening

---

## 10. References

### Utilities (to compose / wrap)

| Module                                       | Key exports                                                   | Pipeline role                                               |
| -------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `_utils/http.ts`                             | `handleCors`, `jsonResponse`, `errorResponse`, `CORS_HEADERS` | Pipeline wraps CORS + responses                             |
| `_utils/logger.ts`                           | `createLogger`, `getCorrelationId`                            | Pipeline creates logger; passes via context                 |
| `_utils/require-authenticated-org-member.ts` | `requireAuthenticatedOrgMember`                               | `secured` preset calls; returns `{ ok, userId, userEmail }` |
| `_utils/gate-organization-request.ts`        | `gateOrganizationRequest`                                     | Alternative bundle (client + auth); Tier-3 pattern          |
| `_utils/zod-schemas.ts`                      | `validateRequest`                                             | Pipeline validates; returns typed body or error             |
| `_utils/idempotency.ts`                      | `checkIdempotencyKey`, `storeIdempotencyKey`                  | Optional layer; **not** used in production yet              |

### Inventory + docs

- `functions-inventory.yaml` + `scripts/validate-functions-inventory.ts` — authoritative classification
- `docs/decisions/style-guide/edge-functions/auth.md`
- `docs/decisions/archive/phase-4-api-and-data-flow-patterns.md`
- [S1 — Edge Function org authorization](./S1-edge-function-org-authorization-enforcement.md) **§18** — deferred items

---

## 11. Summary

| Item                  | Outcome                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| **Verdict**           | **GO** — proceed to **S2** (Features & Functions) for preset matrix + spike scope |
| **Default migration** | **Adopt-on-touch** + mandatory for **new** functions                              |
| **Auth**              | **Compose with** existing gates; inventory remains law                            |

---

_**Promoted:** [S2 — Features & Functions](./S2-unified-edge-handler-pipeline.md) — preset matrix (diamond-reviewed Phase 1 scope), API spec, pilot, verification & rollback._
