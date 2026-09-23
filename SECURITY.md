# Security policy

This is a new application, not a security certification. Do not open production signup until the deployment acceptance checks pass. Publish the operator's private security-reporting channel here before release; do not submit credentials or private tasks in public issues.

## Boundaries

- Supabase owns passwords, identity and email flows. Every application API validates the bearer token using Auth `getUser`; no browser user ID is trusted.
- RLS protects reads. Direct client writes are revoked. The sole task/list/profile RPC authorizes owners, checks optimistic versions, validates foreign references and applies changes atomically.
- Service-role credentials exist only in server modules. Their use is limited to delivery, rate limits, explicitly owner-filtered subscription operations and password-verified account deletion.
- Subscription writes check ownership and use insert or owner-filtered update, avoiding a cross-account upsert race. Endpoints are constrained to supported HTTPS push services to reduce SSRF risk.
- Mutation UUIDs bind to a complete payload. No deletion tombstone is resurrected by stale offline writes.
- Input is rendered as escaped text. No user-controlled HTML, arbitrary script, raw SQL construction, file upload, URL fetching, or open redirect is supported.
- Mutation request bodies are read with a 32 KiB limit. Zod rejects unexpected input fields. PostgreSQL constraints and triggers independently enforce task invariants.
- API requests are limited to 240/minute/user, mutations to 180/minute/user, and account deletion verification to 5/hour/user. These are durable database counters, not process memory. Configure Supabase Auth's separate rate limits and Vercel's edge abuse controls before launch; unauthenticated token-validation abuse needs infrastructure protection.
- APIs use bearer headers rather than ambient auth cookies, avoiding cookie-based CSRF. No permissive CORS headers are provided.
- CSP restricts origins, objects, frames and form targets. Inline script/style allowances support Next's static hydration/offline shell; this is a deliberate residual risk, not a strict nonce CSP. Never introduce unsafe HTML. Eval is allowed only in development. HTTPS production gets HSTS; do not use production on HTTP.
- Private API responses use no-store. The service worker caches only public shell/static assets. Offline snapshots and auth tokens remain readable by scripts on this origin and by someone using an unlocked browser profile. They are not separately encrypted; avoid shared browser profiles.
- Push payloads omit task titles/notes. Push delivery is at least once and may lag or duplicate across devices. It is unsuitable as the sole system for safety-critical reminders.

## Retention and operational work

Tombstones and mutation payload receipts retain deleted task content until account deletion; disclose this in the operator policy. Backups and platform logs have separate retention. Configure quotas, backups, restore exercises, cron health alerts, error monitoring without private payloads, and key-rotation procedures. Scheduler capacity is intentionally bounded and must be load-tested for the deployment's expected users and devices.

Run `npm audit`, type checks, lint and tests before each release. CI tests the actual PostgreSQL migration and direct cross-user access. Hosted Supabase RLS/API and actual browser-device checks remain required.

## Reporting

Before publishing, replace this paragraph with your private vulnerability-reporting contact and response expectations. Supported version: the latest reviewed release only. Do not report a configuration-only preview as production-secure.
