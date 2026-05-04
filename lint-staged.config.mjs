/**
 * Staged-file linting for the monorepo (SCAINET-style).
 * Dashboard ESLint must receive paths relative to `dashboard/`.
 *
 * Edge Functions use Deno — run `deno lint database/supabase/functions` in CI or locally;
 * ESLint is not run here. Prettier **is** applied so CI `prettier --check` on PRs to
 * `staging` / `main` matches what developers commit.
 */
export default {
  "dashboard/**/*.{ts,tsx,mjs}": (filenames) => {
    if (filenames.length === 0) return [];
    const rel = filenames.map((f) => f.replace(/^dashboard\//, ""));
    return [
      `pnpm --filter dashboard exec eslint --fix ${rel.map((f) => JSON.stringify(f)).join(" ")}`,
      `pnpm exec prettier --write ${filenames.map((f) => JSON.stringify(f)).join(" ")}`,
    ];
  },
  "database/supabase/functions/**/*.ts": (filenames) => {
    if (filenames.length === 0) return [];
    return `pnpm exec prettier --write ${filenames.map((f) => JSON.stringify(f)).join(" ")}`;
  },
  "mobile-app/**/*.{ts,tsx}": (filenames) => {
    if (filenames.length === 0) return [];
    return `pnpm exec prettier --write ${filenames.map((f) => JSON.stringify(f)).join(" ")}`;
  },
  "*.{json,md,yml,yaml}": (filenames) => {
    if (filenames.length === 0) return [];
    return `pnpm exec prettier --write ${filenames.map((f) => JSON.stringify(f)).join(" ")}`;
  },
};
