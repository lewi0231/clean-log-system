# Dashboard access & roles — open issues

Working document for **product and engineering** decisions that are not yet implemented.  
Update this file as scope clarifies; link stage docs or PRs when work starts.

---

## Context (current understanding)

- **Admins** — intended primary users of the **web dashboard** (configuration, users, billing-related UI, etc.).
- **Viewers** — intended to **see** dashboard data with **no or limited** ability to change settings or mutate org state (exact matrix TBD).
- **Field workers** — intended to use the **mobile app** for jobs; **not** the web dashboard.
- Today, **authentication** for `/dashboard` routes is largely “has a valid session” rather than a strict **organization role** gate at the middleware/layout level, so **workers can reach the dashboard** if they sign in with the same auth surface.

---

## Issue 1 — Workers must not use the web dashboard

**Problem:** Workers (non–org-user / worker-table accounts) can log into the dashboard. That is a **flaw** relative to the intended split: **dashboard = org staff (admin/viewer)**, **app = field workers**.

**Direction (product):**

- Block worker-only accounts from `/dashboard` (or entire dashboard host) and send them to the app, a dedicated page, or login with messaging.
- Define how we **detect** “worker only” in middleware or a layout gate (e.g. `get-organization-id` + role, `worker` row vs `organization_user`, `auth_user_id`).

**Out of scope here:** Exact redirect URL, deep links, and multi-org edge cases — capture in a short ADR or stage doc when implementing.

**Status:** Not started (record PRs or tickets below).

| Field        |     |
| ------------ | --- |
| Owner        |     |
| Target links |     |

---

## Issue 2 — Viewer role: read-only (or “view all, change nothing”)

**Problem / gap:** The product expectation is that **viewers** can **view** broadly (or “everything”) but **must not** change what admins control (or only a narrow, explicit subset). Today many screens only special-case **admin** vs not; behaviour for **`viewer`** is inconsistent or missing.

**Direction (product):**

- Define a **capability matrix** (route × role: `admin` | `viewer` | blocked).
- Enforce in **one** layer where possible (middleware, layout, or shared hook) with **defence in depth** on mutations (edge functions already enforce some rules; UI should hide or disable).
- Align copy (“You can view this but not edit”) for viewers.

**Status:** Not started.

| Field        |     |
| ------------ | --- |
| Owner        |     |
| Target links |     |

---

## Issue 3 — Email & domain (and similar) admin-only UI

**Note:** The Settings **Email** tab shows **admin-only** copy for non-admins (including workers and viewers). Once Issue 1 and 2 are addressed, re-test this tab and adjust messaging if viewers should see read-only domain status.

**Status:** Tracked under Issues 1–2; no separate project unless product wants viewers to read DNS status without admin.

---

## How to use this file

- Add new issues with the next number.
- Set **Status** to `In progress` / `Done` and link the PR.
- If an issue is large, spawn `docs/stages/S0-…` and reference it here.

---

## Related references (fill as needed)

- Middleware: `dashboard/middleware.ts`
- Org context (role): `get-organization-id` edge function, `useOrganization` hook
- RLS: `organization_user.role`, `worker` table — policy details belong in a dedicated security/stage note when built
