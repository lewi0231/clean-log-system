# Code quality alignment (SCAINET infrastructure standards)

**Reference:** `~/Coding/scainet/infrastructure/code-quality` (linting, formatting, hooks, testing docs).

**Last updated:** 2026-04-11

---

## What this repo now includes

| Standard (SCAINET)                                   | Status in `clean-log-system`                                                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prettier** (`.prettierrc.json`, `.prettierignore`) | **Yes** — root `.prettierrc.json` (aligned with SCAINET defaults: 100 cols, double quotes, LF). Scripts: root `format` / `format:check`; `dashboard` also has `format` / `format:check`.                          |
| **EditorConfig**                                     | **Yes** — root `.editorconfig` (copy of SCAINET-style).                                                                                                                                                           |
| **Husky + lint-staged**                              | **Yes** — root `prepare` runs `husky`; `.husky/pre-commit` runs `pnpm exec lint-staged`. Config: `lint-staged.config.mjs` (dashboard ESLint + Prettier on staged files; Prettier on root `*.{json,md,yml,yaml}`). |
| **ESLint unused imports**                            | **Yes (dashboard)** — `eslint-plugin-unused-imports` in `dashboard/eslint.config.mjs` (SCAINET-style).                                                                                                            |
| **`no-console` in app code**                         | **Yes (dashboard)** — `no-console: warn` with overrides for `__tests__`, `*.test.*`, `vitest.setup.ts`, `vitest.integration.setup.ts`. Prefer `import { log, createLogger } from "@/lib/logger"`.                 |
| **Dashboard logging**                                | **Yes** — `dashboard/lib/logger.ts` uses `loglevel`, supports `LOG_LEVEL` / `NEXT_PUBLIC_LOG_LEVEL`, `createLogger(scope)`, documented for Sentry follow-up.                                                      |

---

## Gaps / deliberate differences

| Topic                                                                | Notes                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCAINET `eslint.config.nextjs.mjs` (className-only-from-globals)** | **Not applied.** That rule discourages Tailwind utilities in favor of inline styles + `globals.css`. This project is **Tailwind-first** (`tailwindcss` v4, utility classes everywhere). Adopting it would flood the repo with warnings. Keep the current Next core-web-vitals + TypeScript + unused-imports stack unless you decide to migrate styling. |
| **`@scainet-enterprise/dev-standards` npm package**                  | **Not installed.** You can run `npx @scainet-enterprise/dev-standards init eslint` later if you want the packaged workflow.                                                                                                                                                                                                                             |
| **VSCode workspace settings**                                        | **Optional.** SCAINET provides `standards/editor/vscode-settings.json` — copy into `.vscode/settings.json` if you want `eslint.useFlatConfig`, format on save, etc.                                                                                                                                                                                     |
| **Edge Functions (`database/supabase/functions`)**                   | **Deno**, not ESLint-in-dashboard. The repo already has **`_utils/logger.ts`** (structured logging + sanitization). **Deno lint** is **not** in the pre-commit hook (not all dev machines have Deno on PATH). Run locally/CI: `deno lint database/supabase/functions` (or per function).                                                                |
| **CI (GitHub Actions)**                                              | **Still recommended** — SCAINET standards assume CI runs `lint`, `format:check`, `typecheck`, tests. This repo had no workflow in `.github/workflows/` at last check; add a workflow that runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (and optionally `deno lint`).                                                            |
| **Mobile app**                                                       | `mobile-app/` has its own ESLint config; not wired into root lint-staged yet. Extend `lint-staged.config.mjs` if you want the same Prettier + ESLint on `mobile-app/**/*`.                                                                                                                                                                              |

---

## Commands

```bash
# Repo root
pnpm format              # Prettier write all
pnpm format:check        # Prettier check (CI)
pnpm exec lint-staged    # Same as pre-commit (staged files only)

# Dashboard only
pnpm --filter dashboard lint
pnpm --filter dashboard lint:fix
pnpm --filter dashboard format

# Edge Functions (requires Deno)
deno lint database/supabase/functions
```

---

## Re-running SCAINET setup script

To refresh from upstream:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/scainet-enterprise/infrastructure/main/code-quality/standards/setup.sh)
```

Review diffs carefully — especially ESLint rules that conflict with Tailwind.
