#!/usr/bin/env bash
# Run Prettier --check on a git diff file list (null-delimited for large diffs).
# Usage: prettier-check-changed.sh <git-rev-from> <git-rev-to>
set -euo pipefail

FROM_REF="${1:?from ref required}"
TO_REF="${2:?to ref required}"

PATTERN='\.(js|jsx|ts|tsx|json|md|yml|yaml|css|mjs|cjs)$'
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

git diff --name-only --diff-filter=d "$FROM_REF" "$TO_REF" \
  | grep -E "$PATTERN" >"$TMP" || true

if [ ! -s "$TMP" ]; then
  echo "No matching files changed ($FROM_REF..$TO_REF)"
  exit 0
fi

COUNT="$(wc -l <"$TMP" | tr -d ' ')"
echo "Prettier check: ${COUNT} file(s) in ${FROM_REF}..${TO_REF}"
# Null-delimited xargs avoids ARG_MAX issues on large PRs (macOS + GNU).
tr '\n' '\0' <"$TMP" | xargs -0 pnpm exec prettier --check
