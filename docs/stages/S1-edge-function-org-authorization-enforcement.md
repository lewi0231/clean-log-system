# S1 — Triage: Edge Function org authorization enforcement

| Field                   | Value                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**               | S1 — Triage (feasibility, risk, scope lock, phased delivery)                                                                                                                                       |
| **From**                | [S0 — Edge Function Org Authorization](./S0-edge-function-org-authorization-enforcement.md)                                                                                                        |
| **Triaged**             | 2026-05-03                                                                                                                                                                                         |
| **Gold review**         | **Completed** 2026-05-03 — see [§13](#13-gold-review-results-2026-05-03)                                                                                                                           |
| **Adversarial review**  | **Completed** 2026-05-03 — see [§14](#14-adversarial-review-results-2026-05-03)                                                                                                                    |
| **Implementation prep** | Phases **1–4** implemented / gated 2026-05-03 — [§15](#15-phase-1-implementation-checklist), [§16](#16-deployment-guidance), [§17](#17-test-infrastructure-prerequisites), **§2.6** inventory + CI |
| **Post-delivery**       | **[§18](#18-postdelivery-status--remaining-work)** — what shipped vs deferred / follow-on                                                                                                          |
| **Product**             | Tally Runner — Supabase Edge Functions (dashboard + mobile API layer)                                                                                                                              |
| **Risk severity**       | **HIGH** — tenant isolation gap; PII/financial data exposure                                                                                                                                       |

---

## 1. Context: locked facts from S0 + codebase audit

| Area                     | Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Total Edge Functions** | **103** functions in `database/supabase/functions/*/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`verify_jwt` setting** | **102 functions** have `verify_jwt = false`; only `send-feedback-email` has `true`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Reason for `false`**   | Documented rationale on some entries (e.g. `[functions.complete-onboarding]` block): bypass gateway JWT verification because functions validate via `getAuthUser`; historically also ES256/runtime issues — treat `verify_jwt` as **platform-level**, not a substitute for org checks                                                                                                                                                                                                                                                                                                                                                                        |
| **Existing helpers**     | **`_utils/auth.ts`:** `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest`. **`requireAuthenticatedOrgMember`** (`_utils/require-authenticated-org-member.ts`) — JWT + token-derived membership only. **`gateOrganizationRequest`** — membership + service-role client bundle. **`requireOrgAdminFromRequest`** — delegates to `requireAuthenticatedOrgMember`, then active-admin check. Legacy grep counted ~**49** entrypoints on `verifyOrganizationMembership*` only; **post‑remediation** canonical counts live in **`functions-inventory.yaml`** + **`pnpm validate:functions-inventory`** (**76** `secured` rows as of Phase 4). |
| **Gap (historical)**     | §2.1 described **original** Tier 1–3 targets — **remediated** Phases **1–3**. Residual security/process gaps → **[§18](#18-postdelivery-status--remaining-work)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Client behavior**      | Both dashboard and mobile use `supabase.functions.invoke()` which passes user JWT automatically                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Style guide**          | `docs/decisions/style-guide/edge-functions/auth.md` documents correct pattern — not universally applied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## 2. Working function inventory

_Prioritized backlog and reference lists below are **tool- and review-backed**; **machine reconciliation** is **`pnpm validate:functions-inventory`** (§2.6)._

### 2.1 Tier remediation backlog _(original S1 targets — implementation complete 2026-05-03)_

_Historical tables below captured **scope before fix**. **Tier 1, Tier 1a, Tier 2** (except documented alternate-auth), and **Tier 3** action endpoints are **done** per phase notes. Current truth for every entrypoint: **`database/supabase/functions/functions-inventory.yaml`** + validator._

#### Functions originally MISSING membership verification (phase targets)

**Tier 1 — Highest risk (PII / financial / bulk data)**

_Gold correction (2026-05-03): removed `get-invoice-details` — it already calls `verifyOrganizationMembershipFromRequest` after loading the invoice. Flagged `list-worker-payments` separately — it verifies membership **only when** a JWT resolves to user id/email; **unauthenticated invokes skip the check** (see §2.1a)._

| Function                    | Data exposed                               | Risk         |
| --------------------------- | ------------------------------------------ | ------------ |
| `list-workers`              | Worker PII (email, phone, name)            | **CRITICAL** |
| `list-jobs`                 | Job details, locations, worker assignments | **CRITICAL** |
| `list-invoices`             | Financial data, pagination, search         | **CRITICAL** |
| `list-payments`             | Payment history                            | **CRITICAL** |
| `list-organization-users`   | Admin user PII (email, role)               | **CRITICAL** |
| `get-organization-settings` | Org configuration, business settings       | **HIGH**     |
| `record-manual-payment`     | Financial mutation                         | **HIGH**     |

_Gold correction (implementation 2026-05-03): **`get-worker`** is **not** an `organization_id`-scoped admin read — it loads **`worker_invitation` by invitation UUID** (raw body) for the **unauthenticated accept-invite** flow. It belongs with token/public flows (§2.3), not Tier 1 JWT+org membership._

**Tier 1a — Conditional verification gap (must harden, not greenfield)**

| Function               | Issue                                                                                                                  | Remediation                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `list-worker-payments` | Calls `verifyOrganizationMembership` only inside `if (userId \|\| userEmail)`; **no token ⇒ no check ⇒ data returned** | **Done (Phase 1):** `requireAuthenticatedOrgMember` before any queries |

**Tier 2 — Medium risk (configuration / metadata)**

| Function                            | Data exposed                  |
| ----------------------------------- | ----------------------------- |
| `list-field-configs`                | Form configuration            |
| `list-form-sections`                | Form structure                |
| `list-locations`                    | Location data                 |
| `list-location-hierarchy`           | Location tree                 |
| `list-workers-and-locations`        | Combined worker/location data |
| `list-field-pricing`                | Pricing configuration         |
| `list-base-pricing`                 | Base pricing                  |
| `list-option-pricing`               | Option pricing                |
| `list-service-pricing-modes`        | Service pricing               |
| `list-pricing-rules`                | Pricing rules                 |
| `list-pricing-history`              | Historical pricing            |
| `list-feedback`                     | Customer feedback             |
| `list-pending-confirmations`        | Pending job confirmations     |
| `get-invoice-template-config`       | Invoice template settings     |
| `get-job-edits`                     | Job edit history              |
| `register-org-sending-domain`       | Domain provisioning (Resend)  |
| `refresh-org-sending-domain-status` | Domain verification polling   |
| `remove-org-sending-domain`         | Domain removal                |

_Phase 2 (2026-05-03): **13** handlers call `requireAuthenticatedOrgMember` immediately after validating `organization_id` and before any DB access. **3** sending-domain functions use `requireOrgAdminFromRequest`, refactored to call `requireAuthenticatedOrgMember` first (mandatory JWT; removes `verifyOrganizationMembershipFromRequest` / `body.email` bypass). **`list-pending-confirmations`** and **`get-job-edits`** use different auth shapes (worker JWT + metadata vs JWT + org resolved from admin email); they were **not** modified in this pass — see note after table._

**Tier 2 — alternate auth (no `organization_id` gate added this phase)**

| Function                     | Why unchanged                                                                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list-pending-confirmations` | Requires JWT + `worker_id` in user metadata; scopes `job_worker` by authenticated worker — no client-supplied org scope to spoof.                                                                                                                                             |
| `get-job-edits`              | Requires JWT; resolves org via `organization_user` by verified email, then loads `job_id` only if `job.organization_id` matches — not a bulk `organization_id`-from-body read. Future: explicit `organization_id` + membership to reduce multi-org `maybeSingle()` ambiguity. |

**Tier 3 — Action endpoints trusting `organization_id` from body without caller membership**

_Gold correction: removed worker flows (`flag-job`, `withdraw-job`, `confirm-job-participation`), admin flows that bind org via `organization_user` + resource keys (`admin-create-job`, `resolve-flagged-job`, `update-job`), and `upload-organization-logo` (org derived from JWT email, no client-supplied org id)._

| Function                | Why it stays in backlog                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update-invoice-status` | Loads invoice by `invoice_id` and mutates without membership check                                                                                                                          |
| `send-invoice-reminder` | Filters invoice with `.eq("organization_id", organization_id)` but **any caller with anon key** who knows `(invoice_id, organization_id)` can trigger email side effects — needs membership |
| `generate-invoice-pdf`  | Same pattern — PDF generation / data exfil risk without caller membership                                                                                                                   |

_Phase 3 (2026-05-03): All three require JWT + org membership via `gateOrganizationRequest` before invoice/org reads or mutations. **`update-invoice-status`** now requires **`organization_id`** in the JSON body (dashboard `InvoiceService` updated); invoice queries additionally constrain by `organization_id` to prevent ID/body mismatch._

_Gold correction: **`record-manual-payment`** appears only in **Tier 1** (Phase 1); it was incorrectly duplicated in an earlier Tier 3 draft._

### 2.2 Functions WITH legacy membership helpers (reference implementations)

**49 function entrypoints** historically imported `verifyOrganizationMembership` and/or `verifyOrganizationMembershipFromRequest` (grep snapshot — includes helpers **before** broad adoption of `requireAuthenticatedOrgMember` / `gateOrganizationRequest`). List retained for **reference handlers**; not an exhaustive “secured” list — see Phase 4 inventory + **`secured`** import heuristic.

```
apply-field-config-template, calculate-invoice, calculate-worker-payment,
complete-onboarding, convert-admin-to-worker, create-field-config, create-form-section,
create-invoice, create-location, create-location-hierarchy, create-organization-user,
create-payment-link, create-pricing-rule, create-worker,
delete-base-pricing, delete-field-config, delete-field-pricing, delete-form-section,
delete-location, delete-location-hierarchy, delete-option-pricing, delete-organization-user,
delete-pricing-rule, delete-service-pricing-mode, delete-test-data, delete-worker,
get-invoice-details,
list-worker-payments,
manage-worker-rate-card, reorder-field-configs, resend-admin-invitation,
resend-worker-invitation, save-worker-payment, send-worker-remittance-email,
submit-beta-feedback,
update-field-config, update-field-config-locations, update-form-section,
update-invoice-template-config, update-location, update-location-hierarchy,
update-organization-settings, update-organization-user, update-pricing-rule,
update-worker, update-worker-payment-status,
upsert-base-pricing, upsert-field-pricing, upsert-option-pricing, upsert-service-pricing-mode
```

**Notes (gold):**

- **`get-invoice-details`** — Uses `verifyOrganizationMembershipFromRequest` **after** fetching the invoice row; acceptable for authorization (optional hardening: avoid wide selects before deny).
- **`list-worker-payments`** — **Phase 1 implemented:** uses `requireAuthenticatedOrgMember` (mandatory JWT + membership before queries).
- **`complete-onboarding`**, **`save-worker-payment`**, **`send-worker-remittance-email`**, **`update-worker-payment-status`** — Use `verifyOrganizationMembership` directly in-branch rather than only `FromRequest`; keep consistent error semantics when tightening tests.

### 2.3 Intentionally public / token-based (NO membership check needed)

| Function                   | Reason                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `get-job-by-token`         | Token-based access for job view                                                         |
| `get-invoice-public`       | Public invoice view by token                                                            |
| `submit-feedback`          | Public feedback submission                                                              |
| `accept-worker-invitation` | Invitation acceptance flow                                                              |
| `get-worker`               | Invitation preview by invitation UUID (raw body); same capability model as invite links |
| `accept-admin-invitation`  | Admin invitation acceptance                                                             |
| `stripe-webhook`           | Stripe signature verification                                                           |
| `register-organization`    | New org registration (no existing org)                                                  |
| `resend-activation-link`   | Pre-auth activation                                                                     |

### 2.4 Identity-derived / JWT-scoped (distinct from §2.1 bulk `organization_id` trust)

| Function              | Pattern                                                                                   | Adversarial nuance                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get-organization-id` | Resolves org from JWT + optional email body                                               | Ensure logs never leak tokens; rate-limit not discussed here.                                                                                           |
| `get-user-role`       | **Requires JWT**; optional `organization_id` in body selects which membership to evaluate | Wrong org ⇒ `{ role: null }` (limited probe). When body omits org, resolution uses admin/worker helpers — interacts with **multi-org** ambiguity (§14). |
| `get-onboarding-data` | Uses auth user context                                                                    | Confirm in implementation pass if org ever taken from body unchecked.                                                                                   |
| `create-job`          | Derives org from authenticated worker/admin                                               | Same `maybeSingle`-style org resolution risks as other admin paths if email maps to multiple rows historically.                                         |

### 2.5 Scheduled jobs (**intent**) vs **public HTTP surface** (**risk**)

| Function                 | Intended trigger                                      |
| ------------------------ | ----------------------------------------------------- |
| `auto-generate-invoices` | Scheduled cron                                        |
| `auto-send-invoices`     | Scheduled cron                                        |
| `auto-approve-jobs`      | Scheduled cron                                        |
| `mark-overdue-invoices`  | Scheduled cron (+ documented manual HTTP for testing) |

**Adversarial fact:** As deployed (`verify_jwt = false` and handlers without a shared secret), these URLs are **invocable by anyone who possesses the same anon key the browser uses**, unless additional platform restrictions apply. `auto-generate-invoices` processes **every organization** in a loop — **`mark-overdue-invoices` mutates invoices globally**. This is **orthogonal** to org-membership bugs but **higher blast radius** than a single `list-*` leak.

**S1 lock:** Hardening batch endpoints is **out of scope for Phases 1–4** of _this_ doc — record as **accepted risk** until a dedicated track (cron secret, private networking, or non-HTTP scheduler).

### 2.6 Inventory completeness before CI enforcement

**Implemented (2026-05-03):** scripted reconciliation + CI gate.

| Artifact                    | Path                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| Inventory (source of truth) | `database/supabase/functions/functions-inventory.yaml`                |
| Validator                   | `database/supabase/functions/scripts/validate-functions-inventory.ts` |
| Local / CI                  | `pnpm validate:functions-inventory`                                   |

The validator enumerates every `*/index.ts` under `database/supabase/functions/`, requires a YAML row per function (orphans or stale rows fail), and enforces that entries classified **`secured`** import at least one shared gate: `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest`, `requireAuthenticatedOrgMember`, `gateOrganizationRequest`, or `requireOrgAdminFromRequest`. Other classes (`public`, `identity`, `privileged_batch`, `alternate_auth`, **`secured_custom`**) skip the import heuristic — **`secured_custom`** is for resource-bound / inline membership patterns documented in S1 (see §2.1 gold notes).

Extended taxonomy vs the §2.6 sketch: `secured_custom` replaces a vague `skip`; **privileged_batch** maps to §2.5.

## 3. Strategic gates (S1 decisions)

| Gate                                               | Decision                   | Notes                                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 — Add membership check to Tier 1 functions**  | **DONE** (2026-05-03)      | **7** bulk-read / financial endpoints + **1** hardening item (`list-worker-payments`)                                                                                                                     |
| **G2 — Add membership check to Tier 2 functions**  | **DONE** (2026-05-03)      | **13** direct gates + **3** via hardened `requireOrgAdminFromRequest`; **2** alternate-auth endpoints documented (see §2.1)                                                                               |
| **G3 — Add membership check to Tier 3 actions**    | **DONE** (2026-05-03)      | **`gateOrganizationRequest`** + body `organization_id` on all three; **`update-invoice-status`** schema extended                                                                                          |
| **G4 — Create `withOrgAuth` wrapper**              | **DONE** (2026-05-03)      | Implemented as **`gateOrganizationRequest`** in `_utils/gate-organization-request.ts` (JWT + membership + shared service-role client)                                                                     |
| **G5 — Enable `verify_jwt = true` where possible** | **DEFER**                  | Re-evaluate after CLI updates                                                                                                                                                                             |
| **G6 — Create authorization test suite**           | **PARTIAL**                | **`require-authenticated-org-member.test.ts`** — early-exit (401) unit tests; **two-org invocation / per-function** suite + **`org-auth-test-helper`** (§17) **not** fully implemented — expand under §18 |
| **G7 — CI lint for missing auth**                  | **DONE** (2026-05-03)      | **`pnpm validate:functions-inventory`** in CI — inventory reconciliation + `secured` import heuristic (§2.6)                                                                                              |
| **G8 — Privileged batch / cron HTTP hardening**    | **DEFER (separate track)** | Accepted risk for S1 org-membership scope — see §2.5                                                                                                                                                      |

## 4. Implementation pattern

### 4.1 Standard fix (add to existing function)

**Adversarial constraint:** `verifyOrganizationMembershipFromRequest` in `_utils/auth.ts` will accept **`body.email` when there is no Bearer token** (`userEmail` is filled from JSON before membership lookup). That allows **any caller who knows an admin’s email address** to satisfy membership **without proving control of that email** unless the handler already requires JWT.

Therefore Phase 1–3 fixes **must not** stop at “call the helper” alone for user-facing routes:

1. **`extractAuthToken` + `getAuthUser`** — reject with **401** if missing/invalid (same as Tier 1a hardening for `list-worker-payments`).
2. **Then** call `verifyOrganizationMembershipFromRequest` **or** call `verifyOrganizationMembership(supabase, organization_id, authUser.email, authUser.id)` using **only token-derived** identity (ignore `body.email` for authz unless product explicitly requires it and is redesigned).

Example shape (pattern only):

```typescript
// AFTER (secure) — JWT required; membership uses verified user only
import { extractAuthToken, getAuthUser, verifyOrganizationMembership } from "../_utils/auth.ts";

serve(async (req) => {
  const body = await req.json();
  const { organization_id } = body as { organization_id: string };
  const supabase = createServiceRoleClient();

  const token = extractAuthToken(req);
  if (!token) {
    return errorResponse("Authentication required", 401);
  }
  const authUser = await getAuthUser(token);
  if (!authUser?.id) {
    return errorResponse("User not found", 401);
  }

  const isMember = await verifyOrganizationMembership(
    supabase,
    organization_id,
    authUser.email ?? null,
    authUser.id
  );
  if (!isMember) {
    logger.warn("Unauthorized access attempt", { organization_id });
    return errorResponse("You do not have permission to access this organization", 403);
  }

  // Proceed — optional: pass { userId: authUser.id, userEmail: authUser.email ?? null } down-stack
});
```

If you standardize on **`verifyOrganizationMembershipFromRequest`**, treat it as safe **only** where the handler has already enforced JWT as above, **or** extend `_utils/auth.ts` with an explicit `requireJwt: true` / `forbidBodyEmailFallback` option in a later refactor (track under §14).

### 4.2 Test pattern (required for each function)

```typescript
Deno.test("list-workers: rejects cross-org access", async () => {
  // Setup: User from Org A tries to access Org B data
  const userFromOrgA = await createTestUser("org-a");
  const orgBId = "org-b-uuid";

  const response = await invokeFunction(
    "list-workers",
    {
      organization_id: orgBId,
    },
    { authToken: userFromOrgA.token }
  );

  assertEquals(response.status, 403);
  assertStringIncludes(await response.text(), "permission");
});

Deno.test("list-workers: rejects spoofed body.email without Bearer token", async () => {
  const response = await invokeFunction("list-workers", {
    organization_id: "any-org-id",
    email: "victim-admin@example.com",
  }); // no Authorization header

  assertEquals(response.status, 401); // must NOT succeed via email-only membership path
});

Deno.test("list-workers: allows same-org access", async () => {
  const user = await createTestUser("org-a");

  const response = await invokeFunction(
    "list-workers",
    {
      organization_id: user.organizationId,
    },
    { authToken: user.token }
  );

  assertEquals(response.status, 200);
});
```

---

## 5. Phased delivery

| Phase                              | Scope                 | Functions                                                                                                                                                                                                                                                                                                  | Exit criteria                                                                                                                                                                   |
| ---------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Critical PII/financial**     | Tier 1 + Tier 1a      | **7** endpoints (`list-workers`, `list-jobs`, `list-invoices`, `list-payments`, `list-organization-users`, `get-organization-settings`, `record-manual-payment`) **plus** harden `list-worker-payments` (require JWT + membership on every path). **`get-worker`** excluded — invitation UUID flow (§2.3). | **Done** 2026-05-03 — `requireAuthenticatedOrgMember`; helper unit tests (401 paths); see §18                                                                                   |
| **2 — Configuration data**         | Tier 2                | **18** entries in §2.1                                                                                                                                                                                                                                                                                     | **Done** 2026-05-03 — `requireAuthenticatedOrgMember` on **13** handlers; sending-domain **3** hardened in `_utils/org-sending-domain-edge.ts`; **2** documented alternate-auth |
| **3 — Action endpoints + wrapper** | Tier 3                | **`gateOrganizationRequest`**                                                                                                                                                                                                                                                                              | **Done** 2026-05-03 — `update-invoice-status` (+ required `organization_id`), `send-invoice-reminder`, `generate-invoice-pdf`; style guide updated                              |
| **4 — CI guard + audit**           | Inventory + heuristic | **Done** 2026-05-03 — `functions-inventory.yaml` + `validate-functions-inventory.ts`; CI step **Validate Edge Functions inventory**                                                                                                                                                                        |

**Phase dependencies** _(historical — initiative complete):_

- Phase 2 starts after Phase 1 is merged and smoke-tested
- Phase 3 wrapper can be developed in parallel with Phase 2
- Phase 4 is independent; can start after Phase 1

---

## 6. Acceptance criteria

### Phase 1 acceptance (per function)

- [ ] Function imports `verifyOrganizationMembershipFromRequest` **or** equivalent (`verifyOrganizationMembership` with mandatory JWT resolution — see `list-worker-payments` Tier 1a)
- [ ] Membership check occurs **before** any database read/write (or invoice-wide mutations gated equivalently)
- [ ] **401** when no valid JWT for user-facing org routes that must identify the caller
- [ ] **403** returned for authenticated cross-org access; tests assert status + permission/deny substring (exact message may vary by handler today)
- [ ] Logger captures unauthorized attempts where patterns already use `logger.warn`
- [ ] Unit test: cross-org access returns **403**
- [ ] Unit test: same-org access returns **200** (or expected success envelope)
- [ ] Negative test: **`organization_id` + `email` in body, no `Authorization`** ⇒ **401** (guards against `_utils` email fallback — §4.2)
- [ ] No breaking changes to request/response shape

### Phase 3 acceptance (`withOrgAuth` wrapper)

- [ ] Wrapper **requires valid JWT** before any membership or body-derived identity
- [ ] Wrapper extracts `organization_id` from body (or from typed context)
- [ ] Wrapper calls `verifyOrganizationMembership` with **token-derived** email/id only (or refactors `_utils/auth.ts` to forbid body-email fallback when `requireJwt: true`)
- [ ] Handler receives verified `{ userId, userEmail, organizationId }` context
- [ ] Existing functions can migrate incrementally
- [ ] Style guide updated with wrapper usage

### Phase 4 acceptance (CI guard)

- [x] Script enumerates all `functions/*/index.ts` entrypoints and reconciles against inventory (**fail** on orphan disk folder or stale YAML key)
- [x] Entries classified **`secured`** must reference a shared org gate symbol (import heuristic — same intent as “`verifyOrganizationMembership` not imported” in S1 draft)
- [x] Inventory file **`database/supabase/functions/functions-inventory.yaml`** is maintained in-repo; **new functions require a classified row**
- [x] **`pnpm validate:functions-inventory`** runs in CI (`.github/workflows/ci.yml`)

_Nuance:_ Per §7, heuristics do not prove branch-complete auth — pair with invocation tests for high-risk handlers when adding coverage.

---

## 7. Risks and mitigations

| Risk                                                            | Impact                                                              | Mitigation                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Breaking existing clients                                       | Clients that don't pass JWT would fail                              | Dashboard + mobile pass JWT; **adversarial:** enumerate scripts, E2E harnesses, or third parties that call Edge URLs **without** `Authorization` before rollout |
| **`verifyOrganizationMembershipFromRequest` body.email bypass** | Without mandatory JWT, attacker supplies victim admin email in JSON | §4.1 pattern + regression test §4.2; consider `_utils/auth.ts` hardening in follow-up                                                                           |
| **Privileged batch endpoints**                                  | Cross-tenant cron logic triggered via HTTP                          | Separate track (§2.5, Gate **G8**) — do not confuse with org-membership fixes                                                                                   |
| Performance overhead                                            | Extra DB query per request                                          | Membership check is indexed lookup; batch endpoints dominate cost elsewhere                                                                                     |
| Missed function in inventory                                    | Gap remains                                                         | Phase 4 reconciliation + CI (§2.6)                                                                                                                              |
| **CI heuristic false negatives / positives**                    | Imports present but branch-skipped checks; or unnecessary friction  | Pair lint with **invocation tests** for Tier 1 handlers                                                                                                         |
| Test flakiness with two-org setup                               | CI instability                                                      | Deterministic fixtures; isolate DB state                                                                                                                        |

---

## 8. Out of scope (S1 lock)

- Enabling `verify_jwt = true` in config.toml (deferred until CLI issue resolved)
- RLS policy refactor (separate initiative)
- **Multi-org correctness** when one identity maps to multiple `organization_user` rows — **accepted debt** for this tranche; admin paths using `maybeSingle()` on email may pick an arbitrary org or mis-route (§14). Full fix = explicit org picker + queries keyed by `(email, organization_id)`.
- **HTTP surface hardening** for `auto-generate-invoices`, `auto-send-invoices`, `auto-approve-jobs`, `mark-overdue-invoices` (Gate **G8** / §2.5)
- Rate limiting per org (separate concern)
- Audit logging of access attempts (enhancement)

---

## 9. Article 1 (PRESERVE) — existing functionality

The fix **adds** authorization checks without intentionally changing:

- Request body shape (still accepts `organization_id`)
- Response format
- Business logic for authorized callers
- Existing tests that use valid auth

**Adversarial caveat:** Callers that relied on **anonymous** or **email-only** access patterns will **stop working** once JWT is mandatory — confirm none exist outside dashboard/mobile (integrations, manual curl, stale scripts).

---

## 10. Test infrastructure required

### 10.1 Shared test helper

Create `database/supabase/functions/__tests__/test-utils/org-auth-test-helper.ts`:

```typescript
export interface TestOrgUser {
  userId: string;
  email: string;
  organizationId: string;
  token: string;
}

export async function createTestOrgUser(orgSuffix: string): Promise<TestOrgUser> {
  // Creates user in test org, returns valid JWT
}

export async function invokeWithAuth(
  functionName: string,
  body: unknown,
  user: TestOrgUser
): Promise<Response> {
  // Invokes function with user's token in Authorization header
}
```

### 10.2 Test file structure

For each fixed function, add test cases to existing test file or create new:

```
database/supabase/functions/__tests__/
├── list-workers.test.ts          # Add authorization tests
├── list-jobs.test.ts             # Add authorization tests
├── list-invoices.test.ts         # Add authorization tests
├── ...
└── test-utils/
    └── org-auth-test-helper.ts   # Shared helper
```

---

## 11. References

### Internal

- [S0 — Edge Function Org Authorization](./S0-edge-function-org-authorization-enforcement.md)
- `database/supabase/functions/_utils/auth.ts` — existing verification helpers
- `database/supabase/functions/_utils/require-authenticated-org-member.ts` — mandatory JWT + `verifyOrganizationMembership` (token-derived identity only); Phases **1–3**
- `database/supabase/functions/_utils/gate-organization-request.ts` — Phase **3** helper: calls `requireAuthenticatedOrgMember`, returns gated `SupabaseClient` + user context
- `database/supabase/functions/_utils/org-sending-domain-edge.ts` — `requireOrgAdminFromRequest` (JWT + org membership + active admin)
- `docs/decisions/style-guide/edge-functions/auth.md` — pattern documentation (prefer `requireAuthenticatedOrgMember` for org-scoped reads)
- `database/supabase/config.toml` — JWT verification settings

### Functions implemented (Phase 1)

- `database/supabase/functions/list-workers/index.ts`
- `database/supabase/functions/list-jobs/index.ts`
- `database/supabase/functions/list-invoices/index.ts`
- `database/supabase/functions/list-worker-payments/index.ts` — **harden** (require JWT; remove unauthenticated success path)
- `database/supabase/functions/list-payments/index.ts`
- `database/supabase/functions/list-organization-users/index.ts`
- `database/supabase/functions/get-organization-settings/index.ts`
- `database/supabase/functions/record-manual-payment/index.ts`

Shared gate: `database/supabase/functions/_utils/require-authenticated-org-member.ts`

**Not Phase 1:** `get-worker` — invitation-token capability only (§2.3).

### Phase 2 handlers (implemented 2026-05-03)

- `database/supabase/functions/list-field-configs/index.ts`
- `database/supabase/functions/list-form-sections/index.ts`
- `database/supabase/functions/list-locations/index.ts`
- `database/supabase/functions/list-location-hierarchy/index.ts`
- `database/supabase/functions/list-workers-and-locations/index.ts`
- `database/supabase/functions/list-field-pricing/index.ts`
- `database/supabase/functions/list-base-pricing/index.ts`
- `database/supabase/functions/list-option-pricing/index.ts`
- `database/supabase/functions/list-service-pricing-modes/index.ts`
- `database/supabase/functions/list-pricing-rules/index.ts`
- `database/supabase/functions/list-pricing-history/index.ts`
- `database/supabase/functions/list-feedback/index.ts`
- `database/supabase/functions/get-invoice-template-config/index.ts`
- Sending-domain gate: `database/supabase/functions/_utils/org-sending-domain-edge.ts` (`requireOrgAdminFromRequest` delegates to `requireAuthenticatedOrgMember`, then active-admin check)

**Alternate auth (unchanged this phase):** `list-pending-confirmations`, `get-job-edits` — §2.1.

**Already secured (gold):** `get-invoice-details` — keep regression tests only if added later.

### Phase 3 handlers (implemented 2026-05-03)

- Shared gate: `database/supabase/functions/_utils/gate-organization-request.ts` (`gateOrganizationRequest`)
- `database/supabase/functions/update-invoice-status/index.ts` — **`organization_id`** required in body; invoice reads/updates scoped by org
- `database/supabase/functions/send-invoice-reminder/index.ts`
- `database/supabase/functions/generate-invoice-pdf/index.ts`

### Phase 4 (implemented 2026-05-03)

- `database/supabase/functions/functions-inventory.yaml` — classified inventory for all **103** entrypoints
- `database/supabase/functions/scripts/validate-functions-inventory.ts` — reconciliation + `secured` import guard
- CI: **Validate Edge Functions inventory** step in `.github/workflows/ci.yml`; local **`pnpm validate:functions-inventory`**

---

## 12. Summary

| Metric                                                | Value                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tier 1 backlog (original)                             | **0** — **done** (Phase 1)                                                                             |
| Tier 1a hardening (`list-worker-payments`)            | **Done**                                                                                               |
| Tier 2 backlog (`organization_id` gate or equivalent) | **0** (implemented + documented alternate-auth §2.1)                                                   |
| Tier 3 backlog                                        | **0** (Phase 3 + `gateOrganizationRequest`)                                                            |
| **Total remediation targets (original S1)**           | **29** function-level items (Tier 1–3); **all addressed** in code + **Phase 4** inventory CI (§2.6)    |
| **`secured` handlers** (shared gate import heuristic) | **76** — machine-checked via **`pnpm validate:functions-inventory`**                                   |
| Legacy grep: `verifyOrganizationMembership*` only     | **49** (§2.2 snapshot — not equivalent to “all gated functions”)                                       |
| Intentionally public / invite-capability              | **9**                                                                                                  |
| Identity / JWT-scoped (§2.4)                          | **4**                                                                                                  |
| Privileged batch HTTP (§2.5, accepted risk)           | **4**                                                                                                  |
| Phases                                                | **4** (complete)                                                                                       |
| **S2 required for org-auth track**                    | **No** — scope delivered; **deferred items** listed **[§18](#18-postdelivery-status--remaining-work)** |

---

## 13. Gold review results (2026-05-03)

| Finding                                                          | Severity          | Resolution in this doc                                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`get-invoice-details` incorrectly listed as unsecured**        | Doc defect        | Removed from Tier 1; listed under §2.2 secured set                                                                                                                                               |
| **`list-worker-payments` “secured” but skips check without JWT** | Security gap      | Tier **1a** — require auth before query                                                                                                                                                          |
| **Tier 3 over-listed worker/admin flows**                        | Doc defect        | Removed `flag-job`, `withdraw-job`, `confirm-job-participation`, `admin-create-job`, `resolve-flagged-job`, `upload-organization-logo` — each binds scope via worker/job or admin org resolution |
| **Sending-domain functions omitted from backlog**                | Coverage gap      | Added `register-org-sending-domain`, `refresh-org-sending-domain-status`, `remove-org-sending-domain` to Tier 2                                                                                  |
| **`send-invoice-reminder` / `generate-invoice-pdf`**             | Authorization gap | **Resolved** — Phase 3: `gateOrganizationRequest` + JWT membership (same pattern as `update-invoice-status`)                                                                                     |
| **`record-manual-payment` duplicated in Tier 3**                 | Doc defect        | Removed from Tier 3; remains **Tier 1 / Phase 1** only                                                                                                                                           |
| **Membership helper count**                                      | Precision         | **49** entrypoints import membership helpers (was “~50”)                                                                                                                                         |
| **`verify_jwt = false` rationale**                               | Precision         | Documented as broader pattern than a single line reference; gateway off ≠ handler secure                                                                                                         |
| **Adversarial note (multi-org admins)**                          | Follow-up         | Elevated to §14 — **accepted debt** in §8                                                                                                                                                        |

Reviewer verification method: read handlers + ripgrep `verifyOrganizationMembership` across `database/supabase/functions/*/index.ts`.

---

## 14. Adversarial review results (2026-05-03)

| Finding                                                                     | Severity                      | Resolution                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`verifyOrganizationMembershipFromRequest` email fallback without JWT**    | **Critical**                  | Documented §4.1 — require JWT first or use `verifyOrganizationMembership` with token-derived identity only; add regression test §4.2; consider `_utils/auth.ts` option to forbid body email for authz |
| **`auto-generate-invoices` / `mark-overdue-invoices` unauthenticated HTTP** | **Critical** (distinct class) | §2.5 + Gate **G8** — accepted **out of scope** for org-membership Phases 1–4; separate hardening track                                                                                                |
| **`auto-send-invoices` / `auto-approve-jobs` unauthenticated HTTP**         | **Critical**                  | Confirmed: `serve()` entry has **no** `extractAuthToken` / shared-secret gate in quick review — same class as §2.5                                                                                    |
| **“Definitive inventory” overclaim**                                        | Doc / process                 | Renamed §2 **Working inventory** + §2.6 reconciliation requirement                                                                                                                                    |
| **`get-user-role` org probe**                                               | Low                           | Returns null for non-membership — note §2.4; multi-org ambiguity remains                                                                                                                              |
| **Multi-org `maybeSingle()` on email**                                      | Medium (correctness)          | §8 explicit accepted debt; can violate tenant intent without crashing                                                                                                                                 |
| **CI lint-only strategy**                                                   | Medium                        | §7 — pair with invocation tests; heuristics miss branch-skipped checks                                                                                                                                |
| **§9 “no breaking changes”**                                                | Communication risk            | Clarified — anonymous/email-only callers may break                                                                                                                                                    |

Reviewer method: threat model “anon key + functions URL” as public; read `_utils/auth.ts` + representative privileged handlers.

---

---

## 15. Phase 1 implementation checklist

Copy for each function during build. Complete in order.

### Per-function checklist

```
Function: ____________________

Pre-implementation:
[ ] Read current handler source
[ ] Confirm function is in Tier 1/1a backlog (not already secured)
[ ] Identify existing logger, error patterns to maintain consistency

Implementation:
[ ] Import `requireAuthenticatedOrgMember` from `../_utils/require-authenticated-org-member.ts` (or inline §4.1 pattern)
[ ] After CORS/body parse + validation, BEFORE any DB query: call `requireAuthenticatedOrgMember(req, organization_id, supabase)` → return `response` if `!ok`; on 403 use `logger.warn` for audit
[ ] Verify response shape unchanged for authorized callers

Tests (add to __tests__/{function-name}.test.ts):
[ ] Cross-org access → 403
[ ] Same-org access → 200
[ ] No Authorization header → 401
[ ] body.email + organization_id without token → 401 (anti-spoof)

Post-implementation:
[ ] Run deno test locally
[ ] Run existing E2E suite (dashboard flows)
[ ] No breaking changes to request/response shape
```

### Phase 1 function order (suggested)

Start with highest risk, simplest structure:

1. `list-workers` — simple select, baseline pattern
2. `list-jobs` — verify pattern transfers
3. `list-invoices` — financial data
4. `list-payments` — financial data
5. `list-organization-users` — admin PII
6. `get-organization-settings` — config data
7. `record-manual-payment` — financial mutation
8. `list-worker-payments` — **harden** (already had conditional check; now mandatory JWT via shared helper)

---

## 16. Deployment guidance

### Pre-deployment verification

- [ ] All Phase 1 tests pass locally
- [ ] `supabase functions serve` smoke test with valid JWT
- [ ] `supabase functions serve` smoke test without JWT → 401
- [ ] No changes to `config.toml` `verify_jwt` settings (keep `false` as documented)

### Deployment sequence

1. Deploy to **staging** environment first
2. Run dashboard E2E suite against staging
3. Manual smoke test: list-workers, list-invoices from dashboard
4. Monitor Supabase logs for 401/403 spikes (unexpected rejections = regression)
5. Deploy to **production** after 24h observation window (or per org risk tolerance)

### Rollback strategy

If production regressions occur:

1. Revert Edge Function to previous version via Supabase CLI:

   ```bash
   supabase functions deploy {function-name} --project-ref {ref}
   ```

   (redeploy from last known-good commit)

2. Verify rollback successful — unauthorized access temporarily re-enabled
3. Diagnose: check which client was sending requests without JWT
4. Fix client, re-apply security fix

### Known rollback risk

Anonymous/email-only callers will break. Before Phase 1 deploy:

- [ ] Grep codebase for `functions.invoke` without auth context
- [ ] Check for external integrations, scripts, or curl-based tools
- [ ] Confirm dashboard + mobile both pass JWT via `supabase.functions.invoke()`

---

## 17. Test infrastructure prerequisites

Before starting Phase 1 implementation, establish:

### Required: Shared test helper

Create `database/supabase/functions/__tests__/test-utils/org-auth-test-helper.ts` (see §10.1).

**Minimum implementation:**

```typescript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface TestOrgUser {
  userId: string;
  email: string;
  organizationId: string;
  token: string;
}

/**
 * Create or retrieve a test user in the specified org.
 * Requires test org + user fixtures in the database.
 */
export async function getTestOrgUser(orgSuffix: "a" | "b"): Promise<TestOrgUser> {
  // Implementation: sign in test user, return token
  // Test users: test-user-org-a@example.com, test-user-org-b@example.com
  // These must exist in test DB with memberships in org-a, org-b respectively
  throw new Error("Implement before Phase 1");
}

/**
 * Invoke Edge Function with optional auth token.
 */
export async function invokeFunction(
  functionName: string,
  body: unknown,
  options?: { authToken?: string }
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.authToken) {
    headers["Authorization"] = `Bearer ${options.authToken}`;
  }

  return fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
```

### Required: Test fixtures

Before tests run, database must contain:

- **Org A** (`test-org-a-uuid`) with admin user `test-user-org-a@example.com`
- **Org B** (`test-org-b-uuid`) with admin user `test-user-org-b@example.com`
- Sample data in each org (workers, jobs, invoices) for positive tests

Fixtures can be seeded via:

- Migration script
- `beforeAll()` in test setup
- Dedicated `seed-test-data` Edge Function

---

## 18. Post–delivery status & remaining work

### Delivered (this initiative — Phases 1–4)

| Area            | Notes                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier 1 / 1a** | `requireAuthenticatedOrgMember` before queries on listed endpoints; **`list-worker-payments`** unconditional JWT path                                                                                                        |
| **Tier 2**      | Direct gates on **13** list/config handlers; **3** sending-domain functions via hardened **`requireOrgAdminFromRequest`** → `requireAuthenticatedOrgMember` first                                                            |
| **Tier 3**      | **`gateOrganizationRequest`** on **`update-invoice-status`**, **`send-invoice-reminder`**, **`generate-invoice-pdf`**; Zod requires **`organization_id`** on status updates; invoice queries scoped by **`organization_id`** |
| **Dashboard**   | **`InvoiceService`** passes **`organization_id`**; **`invoice-list`** / **`invoice-preview-dialog`** wired to org context; tests updated (**Vitest** + payment-flow integration)                                             |
| **Phase 4**     | **`functions-inventory.yaml`** (103 rows); **`validate-functions-inventory.ts`** (reconcile + `secured` import guard); **`pnpm validate:functions-inventory`**; CI step in **`.github/workflows/ci.yml`**                    |
| **Docs / DX**   | **`docs/decisions/style-guide/edge-functions/auth.md`** (`gateOrganizationRequest`, inventory registration); validator uses **`database/deno.json`** imports **`@std/yaml`**, **`@std/path`**                                |

### Deferred / separate tracks (not closed by Phases 1–4)

| Item                                                            | Gate / §     | Notes                                                                                                                                   |
| --------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Gateway `verify_jwt = true`**                                 | **G5**       | Re-evaluate after Supabase CLI / ES256 stability                                                                                        |
| **Privileged batch HTTP** (`auto-*`, `mark-overdue-invoices`)   | **G8**, §2.5 | Cron secret / private invoke / non-HTTP scheduler — **distinct** from org-membership fixes                                              |
| **Full authorization test matrix**                              | **G6**, §7   | Invocation tests (cross-org 403, same-org 200, email spoof 401); **`org-auth-test-helper`** (§17) still aspirational for many functions |
| **`verifyOrganizationMembershipFromRequest` body-email bypass** | §4.1, §14    | Mitigated on **new** gates via **`requireAuthenticatedOrgMember`**; optional **`_utils/auth.ts`** hardening for legacy callers          |
| **Multi-org `maybeSingle()` ambiguity**                         | §8, §14      | Accepted debt — explicit org selection / composite keys later                                                                           |
| **Deno edge lint cleanup**                                      | CI           | **`pnpm lint:edge-functions`** still **`continue-on-error: true`** — orthogonal cleanup                                                 |

### Follow-on product initiative

- **[S1 — Unified Edge handler pipeline](./S1-unified-edge-handler-pipeline.md)** — standardize CORS → parse → validate → log → errors around existing gates (does **not** replace inventory or membership rules).

---

**S1 org-authorization track:** Phases **1–4 complete.** Ongoing risk and process gaps are **§18** rows above, not unimplemented Tier tables.
