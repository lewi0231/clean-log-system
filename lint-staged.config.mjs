/**
 * Staged-file linting for the monorepo (SCAINET-style).
 * Dashboard ESLint must receive paths relative to `dashboard/`.
 *
 * Edge Functions use Deno — run `deno lint database/supabase/functions` in CI or locally;
 * not all machines have Deno on PATH, so it is not in this hook by default.
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
  "*.{json,md,yml,yaml}": (filenames) => {
    if (filenames.length === 0) return [];
    return `pnpm exec prettier --write ${filenames.map((f) => JSON.stringify(f)).join(" ")}`;
  },
};
