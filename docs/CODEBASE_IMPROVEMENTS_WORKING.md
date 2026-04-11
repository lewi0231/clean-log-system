# Codebase improvements — working document

**Status:** Living document (update as work completes)  
**Last reviewed:** 2026-04-11  
**Scope:** `clean-log-system` monorepo — `dashboard/`, `mobile-app/`, `shared/`, `database/` (Supabase), root tooling.

---

## Purpose

Track **actionable** improvements discovered through static review and toolchain checks. This is not a product roadmap; it complements `docs/user_stories/`, `docs/research/`, and `docs/decisions/`.

---

## Executive summary

| Theme | Finding |
| --- | --- |
| **Type safety** | `pnpm typecheck` **fails** on the dashboard package; mobile-app `tsc --noEmit` also **fails** (tests + `hooks/use-alert-dialog.ts`). See [§ TypeScript and test debt](#typescript-and-test-debt-verified-2026-04-11). |
| **CI / automation** | No GitHub Actions workflows found under `.github/` (only `ISSUE_TEMPLATE`). Lint/typecheck/tests are not enforced on push/PR by repo config. |
| **Monorepo boundaries** | `shared/` is **types-only**; dashboard and mobile duplicate patterns (field rendering, auth, UI primitives). |
| **Backend surface** | Large number of Supabase Edge Functions and SQL migrations — strong testing/docs help, but operational complexity is high. |
| **Dependencies** | `@supabase/supabase-js` versions differ between `dashboard` and `mobile-app`. |

---

## Repository map (quick reference)

| Path | Role |
| --- | --- |
| `dashboard/` | Next.js 16 app — admin UI, Stripe, invoicing, settings |
| `mobile-app/` | Expo / React Native — worker flows |
| `shared/` | Shared TypeScript types (`@clean-log/shared`) |
| `database/supabase/` | Migrations, Edge Functions (Deno), `schema.sql` |
| `e2e/` | Playwright E2E (root `playwright.config.ts`) |
| `docs/` | User stories, research, ADR-style decisions, style guides |

---

## Prioritized backlog

Use **P0** = blocks safe releases / breaks CI expectations, **P1** = high leverage, **P2** = quality and speed, **P3** = nice-to-have.

### P0 — Restore a green typecheck (dashboard)

**Evidence:** `pnpm typecheck` at repo root fails in `@clean-log/dashboard`.

**Production / library code (non-exhaustive)** — fix or narrow types so app code compiles:

- `app/invoice/[id]/page.tsx` — `unknown` / `{}` assignments to strict invoice props (needs parsing + typed guards or schema validation).
- `app/worker/accept-invite/[token]/page.tsx` — `undefined` vs `null` state typing.
- `components/invoicing/invoice-document.tsx` — optional `invoice_job` / missing `total` on nested calc types.
- `components/invoicing/base-pricing-editor.tsx`, `option-pricing-editor.tsx` — `locationId` may be `null | undefined` where `string` required.
- `hooks/use-mobile-config.ts` — callback return types: `void` vs `Promise<void>` mismatch vs consumer expectations.
- `hooks/use-organization-settings.ts` — default object missing `edit_window_minutes` vs `OrganizationSettings`.
- `hooks/use-base-pricing.ts` — unsafe cast to `PricingRule` (missing `created_by`, `updated_by`).
- `components/ui/accordion.tsx` — missing dependency `@radix-ui/react-accordion` (or replace implementation).
- `components/ui/password-input.tsx` — `className` on forwarded props typing.

**Tests** — large set of failures from **mocks and fixtures lagging behind types** (e.g. `organizationId` on form components, `refetch` on hooks, `CreateWorkerRequest` no longer accepting `name`, `WorkerPaymentSplit.team_percentage_bonus`, `Job` shapes). Choose one of:

1. **Bring tests in line** with current types (preferred for long-term), or  
2. **Split TS config**: typecheck `app/`, `components/`, `hooks/`, `lib/` separately from `__tests__/` and gate CI on app-only first (tactical; still pay down test debt later).

**Mobile (`mobile-app/`):** Align `hooks/use-alert-dialog.ts` with Expo Router typed routes (or narrow casts); update auth-related tests to satisfy `User`, `Session`, and `Subscription` shapes from `@supabase/supabase-js`.

### P1 — CI pipeline

- Add `.github/workflows/ci.yml` (or similar) to run on PR: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and optionally Playwright on a schedule or label.
- Fail fast on `forbidOnly` (Playwright already respects `CI`).

### P1 — Align shared client and types

- Pin **`@supabase/supabase-js`** to the same major/minor range in `dashboard/package.json` and `mobile-app/package.json` to avoid subtle RPC/realtime differences.
- Consider extending `@clean-log/shared` with **runtime-agnostic helpers** (e.g. Zod schemas mirroring DB types, field-validation helpers) before adding heavy UI to shared.

### P2 — Conventions

- **Hook/file naming** in `dashboard/hooks/`: mix of `use-kebab-case.ts` and `usePascalCase.ts` — pick one convention and document in `docs/decisions/style-guide/`.
- **Cross-platform duplication**: `field-renderer`, address autocomplete, auth hooks — extract only where churn is painful; avoid big-bang shared package refactors.

### P2 — Edge Functions hygiene

- Many functions under `database/supabase/functions/` — keep `SUPABASE_EDGE_FUNCTION_TESTING_GUIDE.md` (or equivalent) current; consider a **function catalog** (name → purpose → auth) in `docs/` for onboarding.
- Track skipped / flaky tests (e.g. integration tests with TODOs around Edge Function cache — see `dashboard/__tests__/integration/payment-flow.test.ts`).

### P3 — Product / engineering TODOs (sample)

| Location | Note |
| --- | --- |
| `dashboard/app/dashboard/settings/page.tsx` | Stripe OAuth connection TODO |
| `database/supabase/functions/_utils/email.ts` | Template troubleshooting TODO |
| `database/supabase/functions/update-organization-settings/index.ts` | Payment providers beyond `stripe` |
| `mobile-app/hooks/use-entry-form.ts` | Re-render investigation |

---

## TypeScript and test debt (verified 2026-04-11)

Command: `pnpm typecheck` (runs `pnpm -r typecheck`).

**Result:** Fails at `@clean-log/dashboard` with a large error set. Dominant categories:

1. **Test mocks** not updated when props/types evolved (`organizationId`, `refetch`, hook return shapes).
2. **Integration tests** missing new required fields (`WorkerPaymentSplit.team_percentage_bonus`, full `Job` fixtures).
3. **Application code** strictness issues listed in [P0](#p0--restore-a-green-typecheck-dashboard).

**Mobile app:** `pnpm --filter @clean-log/mobile-app exec tsc --noEmit` also **fails** (verified same day). Includes test mock drift (`User`, `Subscription`, `session` on auth mocks) and at least one **app hook** issue: `hooks/use-alert-dialog.ts` — router path typing vs `string`.

**Shared:** `shared/` has no `typecheck` script in the recursive run; types-only package is low risk.

---

## Tooling and quality gates

| Check | Root script | Notes |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | Currently failing (dashboard) |
| Lint | `pnpm lint` | Run after typecheck recovery |
| Unit / integration | `pnpm test` | Vitest in dashboard and mobile-app |
| E2E | `pnpm test:e2e` | Playwright; needs `e2e/.env.local` |

---

## Related documentation (do not duplicate)

- **External repo patterns:** `docs/research/repository-recommendations.md`
- **Dashboard UX / design:** `docs/research/dashboard-design-recommendations.md`
- **Style guides:** `docs/decisions/style-guide/README.md`
- **Stripe / payments research:** `docs/research/stripe-*.md`
- **Process / agent framework:** `AGENT_EXCELLENCE_CORE.md`, `HUMAN_PROTOCOL.md`

---

## Working log

| Date | Change |
| --- | --- |
| 2026-04-11 | Initial document: structure, P0–P3 backlog, verified `pnpm typecheck` failure, CI gap, dependency note |

---

## How to use this document

1. **Triage:** Move items into your issue tracker with links to file paths.  
2. **Close the loop:** When P0 is fixed, re-run `pnpm typecheck` and update the “verified” section.  
3. **Avoid duplication:** Deep-dive specs belong in `docs/research/` or user stories; keep this file as a **single checklist** for engineering health.
