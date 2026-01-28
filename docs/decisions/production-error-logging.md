# Production Error Logging: Database vs External Service

## Summary

**Current state:** Errors are **not** persisted to a database. Dashboard logs go to the browser console (loglevel); edge function logs go to Supabase runtime logs (stdout). There is no central store for review.

**Recommendation:** Use an **external error-tracking service** (e.g. Sentry) as the primary way to capture and review production errors. Optionally keep a **lightweight database table** only for high-level error counts or business-critical failure events you want to query in your own SQL—not as a replacement for full error context.

---

## Current Setup

### Dashboard (Next.js)

- **Logger:** `dashboard/lib/logger.ts` uses [loglevel](https://github.com/pwnls/loglevel).
- **Production:** `log.setLevel("warn")` — only `warn` and `error` are emitted.
- **Output:** Browser console only; nothing is sent to a server or database.
- **Error boundary:** `app/dashboard/error.tsx` logs with `console.error("Dashboard error:", error)` — no persistence or external service.

### Edge Functions (Deno)

- **Logger:** `database/supabase/functions/_utils/logger.ts` — structured JSON to stdout (`console.log` / `console.error` / `console.warn`).
- **Output:** Supabase project Logs (Dashboard → Logs), i.e. runtime log streaming. Not written to any Postgres table.
- **Sanitization:** PII is redacted (passwords, tokens, emails masked) before logging.

### What Exists Today

- No `application_error` or `error_log` table.
- Audit-style tables exist for domain events (e.g. `job_edits_audit`, `pricing_audit`, `product_feedback`) but not for generic application/exception logs.
- No Sentry, Datadog, or other error-tracking SDK in the repo (phase-4 archive only mentioned Sentry as a future idea).

So: **you are not currently set up to save production errors in the database for review.** Errors are only visible in browser DevTools and Supabase Logs.

---

## Should You Log Errors in Production?

Yes. Production errors should be:

1. **Captured** — so they are not lost when the tab closes or the function exits.
2. **Centralized** — one place to see dashboard + edge function failures.
3. **Queryable** — filter by time, feature, severity, organization.
4. **Actionable** — alerts and grouping so you can fix recurring issues.

The open question is **where** to store them: your own database vs an external service.

---

## Option A: Store Errors in Your Database

### How it would work

- Add a table, e.g. `application_error`, and write rows from:
  - **Dashboard:** catch in error boundary + service layer; call an edge function or API that inserts into the table.
  - **Edge functions:** after `logger.error(...)`, also insert into `application_error` (e.g. via Supabase client in the same function).

### What to store (minimal, safe set)

Keep only what you need for debugging and accountability, and **avoid PII** so logs stay compliant and safe to keep.

| Field | Type | Purpose |
|-------|------|--------|
| `id` | UUID | Primary key |
| `occurred_at` | TIMESTAMPTZ | When the error happened |
| `source` | TEXT | e.g. `dashboard`, `edge_function` |
| `environment` | TEXT | e.g. `production`, `staging` |
| `function_or_route` | TEXT | Edge function name or app route (no query params or tokens) |
| `level` | TEXT | `error`, `warn` |
| `message` | TEXT | Short, sanitized message (no user input or PII) |
| `error_name` | TEXT | e.g. `EdgeFunctionError`, `TypeError` |
| `error_code` | TEXT | Optional, e.g. HTTP status or custom code |
| `organization_id` | UUID (nullable) | For scoping; only if already in context |
| `correlation_id` | TEXT | Request/trace ID for linking to other logs |
| `stack_trace` | TEXT (nullable) | Server-side only; strip file paths if sensitive |
| `metadata` | JSONB (nullable) | Extra context; **must be sanitized** (no emails, tokens, raw bodies) |
| `resolved_at` | TIMESTAMPTZ (nullable) | If you add a “mark resolved” workflow |

**Do not store:** full request/response bodies, passwords, tokens, email addresses, IPs (unless you have a legal basis and retention policy), raw user input. Your edge logger already has sanitization; reuse the same rules for DB payloads.

### Pros

- All data stays in your infra; no third-party SDK.
- You can join with `organization`, `job`, etc. in SQL.
- No per-event cost from a vendor.
- Full control over schema and retention.

### Cons

- You must build and maintain: schema, retention/archiving, alerts, grouping, and (if you want) a small UI to browse errors.
- No built-in stack trace symbolication, release tracking, or user-impact metrics.
- High-volume logs can blow up table size and slow down the DB if you log every warning; you need sampling or severity filters.
- If the DB or the “log insert” path is down, you can lose errors or create feedback loops (e.g. logging failure → retry → more load).

---

## Option B: Use an External Error-Tracking Service (Recommended)

### How it would work

- Integrate a dedicated error-tracking product (e.g. **Sentry**, or a generic observability platform like Datadog/Highlight).
- **Dashboard:** add SDK; in the error boundary and in `invokeEdgeFunction` (or central catch), call the SDK to report errors (with sanitized context).
- **Edge functions:** either send errors to the same service via HTTP (from the function) or rely on the vendor’s Supabase/integration if they have one. Alternatively, keep using Supabase Logs and optionally forward critical errors via a small “report error” edge function that calls the vendor API.

### What they typically store (and you can restrict)

- Exception type, message, stack trace.
- Environment, release, URL/route (you can strip query params and PII).
- User: usually an **opaque id** (e.g. `organization_user_id`), not email/name, unless you explicitly add it and accept the privacy trade-off.
- Tags: e.g. `organization_id`, `function_name`, `correlation_id`.
- Breadcrumbs and extra context (again, you control what you send).

You configure PII redaction and sampling in the SDK and/or in the vendor’s pipeline.

### Pros

- Purpose-built: grouping, alerts, release health, performance.
- Off-the-shelf integrations and dashboards; little custom code.
- Errors are stored **outside** your app DB, so a DB outage doesn’t block reporting.
- Common pattern; teams are used to Sentry/Datadog.

### Cons

- Cost at scale (often per event or per month).
- Data leaves your perimeter (mitigated by redaction and DPA/vendor selection).
- Dependency on a third party.

---

## Best-Practice Takeaway (from research)

- **Observability:** Prefer a single place that can correlate **logs, traces, and errors** (e.g. OpenTelemetry + backend). For “errors only,” a dedicated error tracker (Sentry) is still the most practical.
- **Storage:** Prefer **external/service-side storage** for full error payloads (stack, context, grouping). Use the **database** only for business-level “something failed” events or aggregates you want in your own SQL, not as the main error store.
- **PII:** Never log/store PII in error payloads unless necessary and legally justified; use IDs and sanitizers (you already have this in edge `logger.ts`).
- **Structured logging:** Keep using structured, JSON-like fields so you can query and filter (you already do this in edge functions).

So: **yes, log errors in production**, but **prefer an external error-tracking service** for “saving them for review.” Use the DB only for lightweight, high-level events if you need them in your own schema.

---

## Recommendation for This Project

1. **Introduce an external error-tracking service (e.g. Sentry) as the primary mechanism.**
   - Dashboard: Sentry React SDK in the error boundary and optionally in a global handler or in `invokeEdgeFunction` when you catch.
   - Edge: either report from the function to Sentry (e.g. HTTP) or tag Supabase Logs and add a separate “critical errors” report path later.
   - Configure: environment, release, `organization_id` (or org_user id) as tag; no emails/passwords in context.
2. **Do not add a large “every error to the database” pipeline** unless you have a clear need to query errors in SQL (e.g. “count 5xx by org for billing”). If you do, add a **small** table and write only high-level facts (e.g. `occurred_at`, `source`, `function_name`, `organization_id`, `message`), and still send full detail to Sentry.
3. **Harden current logging:**  
   - In `dashboard/app/dashboard/error.tsx`, replace `console.error` with a call to your logger and/or the future Sentry `captureException`, so all dashboard errors go through one path.  
   - Keep edge function logs as they are (Supabase Logs + optional Sentry); ensure no PII in `metadata` or `message` when you add DB or HTTP reporting.

If you later add a DB table, use the “What to store” section above: minimal fields, no PII, and optional retention/archiving (e.g. partition by month, delete after 90 days).

---

## References

- Style guide: `docs/decisions/style-guide/universal/error-handling.md` (structured logging, rethrow, no swallowing).
- Edge logger: `database/supabase/functions/_utils/logger.ts` (sanitization, correlation ID, JSON stdout).
- Dashboard logger: `dashboard/lib/logger.ts` (loglevel, production level `warn`).
- Phase-4 archive: mentioned “Error tracking with Sentry” as future work.
- External: Datadog log best practices, OpenTelemetry logs, New Relic/PII-in-logs guidance, Sentry vs Datadog comparisons (error-centric vs full observability).
