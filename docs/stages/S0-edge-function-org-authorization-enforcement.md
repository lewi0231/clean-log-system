# S0 — Idea Intake: Enforce verified org authorization on Edge Functions (service-role paths)

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)               |
| **Captured** | 2026-05-03                                                        |
| **Updated**  | 2026-05-03 (open questions researched)                            |
| **Product**  | Tally Runner (dashboard, mobile runner, Supabase Edge Functions)  |
| **Source**   | Codebase review — security and maintainability of org-scoped APIs |

---

## 1. Idea (submitter language)

**Several Supabase Edge Functions** create a **service-role Supabase client** (bypassing RLS), then scope reads and writes **only using `organization_id` (and related IDs) supplied in the request body**. In many places there is **no step that proves** the authenticated caller (JWT / worker / admin) is **actually a member of that organization**.

Some functions **already** call `verifyOrganizationMembershipFromRequest` from `database/supabase/functions/_utils/auth.ts`; others **never do**, including multiple **`list-*`** style endpoints.

At the same time, **`database/supabase/config.toml` sets `verify_jwt = false` for many functions**, meaning the platform does not automatically reject unauthenticated invokes. **Correct authorization must therefore live entirely inside each handler** — which is easy to omit or regress.

The idea is to **systematically enforce** org authorization for every user-facing, org-scoped Edge Function that uses the service role, **without** relying on reviewers to remember the check each time.

---

## 2. Problem / opportunity (why this matters)

### Risk

| Concern                     | Note                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant isolation**        | If a caller can invoke a function with a **public-ish** gateway pattern (anon key + function URL patterns as typically embedded in clients), trusting **only** `organization_id` from JSON can **cross tenant boundaries**. |
| **Inconsistent guarantees** | Mix of “validated membership” vs “none” creates **ambiguous security posture** and confuses future contributors (“this list endpoint looks like that one”).                                                                 |
| **Regression surface**      | New endpoints can copy minimal `serve + service role + body org_id` scaffolding and ship **without** authz review catching it.                                                                                              |

### Opportunity

| Benefit                            | Note                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single enforcement pattern**     | A shared wrapper or mandatory pipeline makes **authorization part of structure**, not memory.                                                   |
| **Clear classification**           | Explicit categories: **user + org scoped**, **worker scoped**, **public token**, **cron / internal-only** — each with documented rules.         |
| **Aligns with existing utilities** | `verifyOrganizationMembership` / `verifyOrganizationMembershipFromRequest` already encode the membership model; reuse beats one-off divergence. |

### Observed codebase facts (examples, not an exhaustive audit)

| Function (example)     | Pattern observed                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `list-workers`         | Service role → `organization_id` from body → query; **no** `verifyOrganizationMembershipFromRequest` in file.               |
| `list-field-configs`   | Same structural pattern as above.                                                                                           |
| `list-jobs`            | Validates body with Zod; service role query by `organization_id`; **no** membership helper usage in file.                   |
| Many mutating handlers | **`verifyOrganizationMembershipFromRequest`** is used in numerous `index.ts` files (grep-backed observation during review). |

_**S1** should produce a definitive inventory (script or checklist): every function entrypoint classified as authenticated-org, alternate auth, or intentionally public._

---

## 3. Success (what “good” looks like — draft)

| Outcome                               | Description                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No silent trust of body org id**    | For every **authenticated, org-scoped** function using service role, the handler **either** derives allowed org ids from verified identity **or** rejects **before** data access when membership fails. |
| **Mechanical consistency**            | New org-scoped functions go through **one documented path** (wrapper(s), codegen checklist, or CI guard) such that omission is **obvious at review or build time**.                                     |
| **Explicit public / token contracts** | Endpoints intended to be invoked **without** org membership checks (e.g. token links, onboarding, webhooks) are **labeled and reviewed** deliberately — not ambiguous.                                  |
| **JWT strategy is intentional**       | `verify_jwt` settings in `config.toml` align with handler design: documented reason for **false** vs **true** per function category.                                                                    |

_Exact middleware shape, rollout order (fix critical reads first vs big-bang), and regression tests belong in **S1**._

---

## 4. Research summary (landscape — not a decision yet)

### 4.1 Supabase Edge Functions auth models (conceptual)

| Model                                              | Rough idea                                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gateway JWT verification** (`verify_jwt = true`) | Validates user JWT **before** the function runs; simplifies “has a user” — **still** requires app-level org checks when using service role.                 |
| **`verify_jwt = false`**                           | Handler receives unverified gateway behavior per Supabase docs; **must** implement auth/authz internally or expose only non-sensitive operations.           |
| **User-scoped client + RLS**                       | Avoid service role where possible so Postgres policies enforce tenancy; Edge Function becomes thinner. _(Not always possible with admin-style operations.)_ |

**S1** maps which endpoints can migrate toward **RLS + user JWT** vs must stay **service role** for operational reasons.

### 4.2 Existing building blocks

- `extractAuthToken`, `getAuthUser`, `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest` — `database/supabase/functions/_utils/auth.ts`.
- Phase-4 style guide excerpts in `docs/decisions/archive/phase-4-api-and-data-flow-patterns.md` describe a **standard lifecycle** for handlers (CORS → validate → auth → logic).

Gap: **lifecycle is documented but not uniformly applied** across all endpoints.

### 4.3 Design directions (for S1 triage — **not decided in S0**)

| Direction                                                         | Summary                                                                      | Tradeoffs                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **A. Middleware / `withOrgAuth`**                                 | Wrap `serve` handlers; require membership before handler body runs.          | Centralizes fixes; requires typing request context cleanly.              |
| **B. Turn on JWT verify where possible + keep membership checks** | Reduce anonymous invoke surface at the edge.                                 | May break clients that omit user JWT incorrectly; inventory needed.      |
| **C. Reduce service role reads**                                  | Use user client + RLS for list/read paths where feasible.                    | Schema and policy work; safest long-term tenancy model where applicable. |
| **D. CI lint / codegen**                                          | Script: fail if org_id from body appears without pairing auth helper/import. | Heuristic-only; complements A–C                                          |

**Recommended default for MVP hardening:** **A + inventory (D)** first; pursue **C** selectively per resource in later phases.

---

## 5. Stakeholder assumptions (explicit)

| Topic                | Captured assumption                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Product boundary** | All org-scoped dashboards and authenticated mobile flows **must only** expose data for orgs the caller belongs to.               |
| **Public endpoints** | Token-based reads (example family: job-by-token flows) remain **exceptions** — **S1** names each exception and acceptance tests. |

---

## 6. Open questions — researched findings and recommendations

### Question 1: Complete inventory of Edge Functions with classification

**Research findings:**

- **103 total Edge Functions** exist in `database/supabase/functions/*/index.ts`
- **Only 1 function** has `verify_jwt = true` in `config.toml`: `send-feedback-email`
- **~50 functions** import and use `verifyOrganizationMembershipFromRequest` (grep-verified)
- **~53 functions** do NOT use the membership helper — including most `list-*` endpoints

**Classification breakdown:**

| Category                                | Count | Examples                                                                                                                                                     |
| --------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Org-scoped WITH membership check**    | ~50   | `update-worker`, `create-invoice`, `delete-field-config`, `update-organization-settings`                                                                     |
| **Org-scoped WITHOUT membership check** | ~25   | `list-workers`, `list-jobs`, `list-invoices`, `list-field-configs`, `list-organization-users`, `list-feedback`, `list-payments`, `get-organization-settings` |
| **Token/public (intentionally open)**   | ~8    | `get-job-by-token`, `get-invoice-public`, `submit-feedback`, `accept-worker-invitation`, `accept-admin-invitation`, `stripe-webhook`                         |
| **Identity-derived (safe pattern)**     | ~5    | `get-organization-id`, `get-user-role`, `get-onboarding-data`, `complete-onboarding`                                                                         |
| **Cron/internal**                       | ~8    | `auto-generate-invoices`, `auto-send-invoices`, `auto-approve-jobs`, `mark-overdue-invoices`                                                                 |
| **Other/uncategorized**                 | ~7    | `register-organization`, `delete-test-data`, `resend-activation-link`                                                                                        |

**Recommendation:** Create a **machine-readable inventory file** (YAML or JSON) listing every function with its classification and whether membership check is present. Use a CI step to warn when new functions don't match expected patterns.

---

### Question 2: Is `verify_jwt = false` required or legacy?

**Research findings:**

- **Comment in `config.toml` line 372–373** explains the reason:
  > "Bypass runtime JWT verification - function does its own auth via getAuthUser(token). Required after Supabase CLI upgrade: runtime ES256 key format causes TypeError"
- This indicates a **Supabase CLI/runtime compatibility issue** forced `verify_jwt = false` as a workaround.
- Both **dashboard and mobile** call `supabase.functions.invoke()` which **automatically passes the user's JWT** from the active session.
- The JWT is present in requests — the issue is functions **not validating it** internally.

**Can `verify_jwt = true` be restored?**

- Potentially yes, once the ES256 key format issue is resolved or the CLI is updated.
- However, even with `verify_jwt = true`, **org membership checks are still required** because JWT verification only proves "user exists", not "user belongs to this org".
- Turning on `verify_jwt = true` would **reject truly unauthenticated requests** at the gateway, reducing attack surface — but **does not eliminate the need for in-function membership checks**.

**Recommendation:**

1. **Short-term:** Keep `verify_jwt = false` but **mandate** `verifyOrganizationMembershipFromRequest` for all org-scoped handlers.
2. **Medium-term:** Re-test `verify_jwt = true` after Supabase CLI updates; enable where possible as defense-in-depth.
3. **Document:** Each function's `verify_jwt` setting and internal auth pattern in the inventory file.

---

### Question 3: Should `organization_id` ever be accepted from JSON?

**Research findings:**

- **Current safe pattern** (`get-organization-id`): Derives org from verified JWT user — looks up `organization_user` or `worker` table.
- **Current risky pattern** (`list-invoices`, `list-workers`, etc.): Accepts `organization_id` from JSON body and trusts it.
- **Style guide** (`docs/decisions/style-guide/edge-functions/auth.md`) already documents the correct pattern: verify JWT → verify org membership → proceed.
- Dashboard/mobile **always know the user's org** from prior `get-organization-id` call, so passing it in JSON is **convenience, not necessity**.

**Design options:**

| Option                                                   | Description                                          | Tradeoffs                                     |
| -------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| **A. Accept from JSON + always verify membership**       | Keep current API shape; add missing checks.          | Minimal client changes; relies on discipline. |
| **B. Derive org from JWT only (never accept from body)** | Functions internally resolve org from user identity. | Cleanest security model; more refactoring.    |
| **C. Accept from JSON for multi-org users only**         | Single-org users auto-derive; multi-org can specify. | Supports future multi-org; adds complexity.   |

**Recommendation:** **Option A** for MVP hardening — keep accepting `organization_id` from JSON but **always verify** the calling user is a member of that org before any data access. This is the pattern `update-worker` and other write functions already use. Option B can be pursued later as a larger refactor.

---

### Question 4: Rollout strategy — highest risk first vs big-bang?

**Research findings:**

- **Highest-risk endpoints** (bulk data / financial / PII):
  - `list-invoices` — financial data, pagination, search
  - `list-jobs` — job details, worker assignments, locations
  - `list-workers` — worker PII (email, phone)
  - `list-organization-users` — admin user PII
  - `list-worker-payments` — payment amounts, bank details
  - `list-payments` — payment history
  - `get-organization-settings` — org configuration
- **Lower-risk endpoints** (configuration / metadata):
  - `list-field-configs`, `list-form-sections`, `list-pricing-rules`, etc.

**Recommendation:** **Phased rollout by risk tier:**

| Phase                          | Scope                                                                                                            | Rationale                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Phase 1 (immediate)**        | `list-workers`, `list-jobs`, `list-invoices`, `list-worker-payments`, `list-payments`, `list-organization-users` | Highest PII/financial exposure |
| **Phase 2 (fast-follow)**      | `list-*` remaining + `get-organization-settings`                                                                 | Complete all read paths        |
| **Phase 3 (consolidation)**    | Introduce `withOrgAuth` wrapper; refactor existing functions to use it                                           | Prevent future regressions     |
| **Phase 4 (defense-in-depth)** | Re-evaluate `verify_jwt = true` viability                                                                        | Gateway-level rejection        |

**No feature flag needed** — these are security fixes, not feature toggles. However, **add integration tests for each function** before and after to catch regressions.

---

### Question 5: Testing strategy — where do authorization tests live?

**Research findings:**

- **Existing test:** `database/supabase/functions/__tests__/authorization.test.ts` tests **concepts** (role checks, org membership logic) but does **not invoke actual functions**.
- **39 function-level test files** exist under `__tests__/` — most test business logic, not cross-org access rejection.
- **E2E tests** in `e2e/` use Playwright for dashboard flows — could potentially test unauthorized access scenarios.

**Recommended testing layers:**

| Layer                 | Location                                                                 | What to test                                                                                                            |
| --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Unit tests**        | `database/supabase/functions/__tests__/<function>.test.ts`               | Mock `verifyOrganizationMembershipFromRequest` returning `false` → expect 403                                           |
| **Integration tests** | `database/supabase/functions/__tests__/<function>-authorization.test.ts` | Use real Supabase client with two test orgs; call function with Org A's user and Org B's `organization_id` → expect 403 |
| **E2E smoke tests**   | `e2e/authorization/cross-org-access.spec.ts`                             | Logged-in user manipulates request to access another org's data → verify no data returned                               |

**Specific test pattern for each function:**

```typescript
Deno.test("list-workers: rejects cross-org access", async () => {
  // Setup: User belongs to org-A, requests org-B data
  const response = await invokeFunction(
    "list-workers",
    {
      organization_id: "org-B-id",
    },
    { authToken: userFromOrgA.token }
  );

  assertEquals(response.status, 403);
  assertStringIncludes(response.body.error, "permission");
});
```

**Recommendation:**

1. Add **authorization test cases** to each function's existing test file (co-located).
2. Create a **shared test helper** that sets up two test orgs and users for cross-org testing.
3. Add a **CI gate** that fails if any org-scoped function lacks an authorization test.

---

## 7. Out of scope for S0 (explicit)

- Exact implementation PRs or refactors per function file.
- Final choice of JWT flag per function until inventory exists.
- RLS rewrite design for tables currently accessed only via service role.
- Mobile or dashboard UX changes unrelated to authorization.

---

## 8. Post–gate check (S0 quality)

> If someone reads this idea in 6 months with no other context, will they understand what was meant?

**Reader should take away:** Org-scoped Edge Functions that use the **service role** must **not** trust **`organization_id` from the client** without **binding** it to verified membership. Today the codebase is **inconsistent**, and **`verify_jwt = false`** makes per-handler omission dangerous. Work should **enforce** authorization **structurally**, classify **exceptions** deliberately, and use **S1** to inventory and sequence fixes.

---

## 9. References

### Internal (codebase)

**Auth utilities:**

- `database/supabase/functions/_utils/auth.ts` — `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest`, `extractAuthToken`, `getAuthUser`

**Examples lacking membership verification:**

- `database/supabase/functions/list-workers/index.ts`
- `database/supabase/functions/list-jobs/index.ts`
- `database/supabase/functions/list-invoices/index.ts`
- `database/supabase/functions/list-field-configs/index.ts`
- `database/supabase/functions/list-organization-users/index.ts`

**Examples WITH membership verification (reference pattern):**

- `database/supabase/functions/update-worker/index.ts` — fetches resource, then verifies membership
- `database/supabase/functions/create-invoice/index.ts`
- `database/supabase/functions/delete-field-config/index.ts`

**Safe identity-derived pattern:**

- `database/supabase/functions/get-organization-id/index.ts` — derives org from verified JWT

**Configuration:**

- `database/supabase/config.toml` — `verify_jwt` entries (only `send-feedback-email` has `true`; comment explains ES256 workaround)

**Client invocation:**

- `dashboard/lib/supabase/invoke-edge-function.ts` — uses `supabase.functions.invoke()` which passes JWT
- `mobile-app/app/(tabs)/jobs.tsx` — same pattern

**Existing tests:**

- `database/supabase/functions/__tests__/authorization.test.ts` — tests concepts, not function enforcement

**Working index:**

- `docs/improvements/code-quality-and-maintainability-working-document.md`

### Related style / architecture docs

- `docs/decisions/style-guide/edge-functions/auth.md` — documents correct auth pattern (already ignored by many functions)
- `docs/decisions/archive/phase-4-api-and-data-flow-patterns.md` — intended request lifecycle

---

## 10. Summary of recommendations

| #   | Question                 | Recommendation                                                                                                           |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Inventory                | Create machine-readable inventory file; CI step to enforce patterns on new functions                                     |
| 2   | `verify_jwt = false`     | Keep for now (ES256 issue); mandate in-function membership checks; re-evaluate after CLI updates                         |
| 3   | Accept org_id from JSON? | Yes, but **always verify membership** before data access (Option A)                                                      |
| 4   | Rollout                  | Phased by risk: Phase 1 = highest PII/financial (`list-workers`, `list-invoices`, etc.); Phase 3 = `withOrgAuth` wrapper |
| 5   | Testing                  | Co-located authorization tests per function; shared two-org test helper; CI gate requiring auth tests                    |

---

_End of S0 — **S1 created:** [`S1-edge-function-org-authorization-enforcement.md`](./S1-edge-function-org-authorization-enforcement.md)_
