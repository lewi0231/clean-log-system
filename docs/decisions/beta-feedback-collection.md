# Beta Feedback Collection

## Context

During beta, we want users to submit product feedback (bugs, ideas, general comments) as they use the app, without leaving the flow or remembering to email later.

## Industry Best Practices

- **Always-available entry point** — A persistent “Send feedback” control (e.g. in the sidebar or header) so users can submit whenever something strikes them, without searching for a form or email address.
- **Context capture** — Automatically record the current page/URL (and optionally timestamp) so triage is easier (“they were on Pricing when they hit this”).
- **Low friction** — Short form: optional category (Bug / Idea / General) plus free-text message. Avoid long surveys or required NPS during beta.
- **Non-invasive** — Use a sheet or modal, not a full-page form. Don’t block the main workflow.
- **Optional quick sentiment** — Thumbs up/down or a 1–5 scale can boost response but add friction; for beta, a simple “What’s on your mind?” plus category is usually enough.
- **Triage-friendly** — Store `organization_id`, `user_id` (if available), `page_path`, `category`, and `message` so you can filter and prioritise in one place.

## Decision

We implement in-app beta feedback as follows:

1. **Storage** — New table `product_feedback` with: `organization_id`, `user_id` (nullable), `page_path`, `category` (`bug` | `idea` | `general`), `message`, `created_at`. RLS allows authenticated org members to insert only.
2. **API** — Edge function `submit-beta-feedback` accepts `organization_id`, `message`, and optional `category`, `page_path`; verifies org membership via JWT; inserts one row.
3. **UI** — A “Send feedback” entry point in the dashboard (sidebar or header) that opens a sheet with:
   - Optional category select (Bug / Idea / General)
   - Required message textarea
   - Auto-filled “Where?” (current path) for context
   - Submit calls the edge function; toast on success or error.

The existing `feedback` table and `submit-feedback` / `list-feedback` remain for **job feedback** (customer ratings on completed jobs). Product/beta feedback is separate.

## References

- [Amplitude – In-app feedback](https://amplitude.com/explore/product/in-app-feedback)
- [Instabug – User feedback best practices](https://www.instabug.com/blog/user-feedback-best-practices)
- [Stream – In-app feedback](https://getstream.io/blog/in-app-feedback/)
- [UXPin – Collecting in-app feedback](https://www.uxpin.com/studio/blog/in-app-feedback/)
