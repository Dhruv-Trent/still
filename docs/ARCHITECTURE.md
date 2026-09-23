# Still architecture

Next.js App Router serves a public landing page, /auth, /auth/callback, /workspace, /privacy and /terms. Authenticated data is never embedded in public HTML. Supabase Auth handles email/password, verification and recovery. The browser uses the public Supabase key for identity and realtime only; API requests verify the bearer token with getUser and run database operations under that user's JWT and RLS.

Postgres owns profiles, lists, tasks, recurrence series, reminders, subscriptions and mutation receipts. Composite owner foreign keys prevent cross-user associations. All application tables enable RLS; no browser policy accesses delivery leases or rate-limit records. Mutations go through one atomic SQL function, with UUID idempotency keys and optimistic version checks. Tombstones prevent resurrection after deletion. Conflicting offline edits stay queued and can be explicitly rebased or discarded.

IndexedDB holds account-scoped snapshots and a durable mutation queue. No private responses are cached by the service worker; its offline document loads cached static code and the user's local snapshot. Sign-out clears local data. Realtime invalidates snapshots, with a periodic fallback. Only successfully acknowledged mutations leave the queue.

Recurrence is represented by a series and explicit occurrences. Completion materializes the next occurrence transactionally using local calendar arithmetic and an IANA timezone. A unique (series_id, occurrence_index) constraint prevents duplicates. Series changes affect existing future occurrences and the template. Single occurrence changes do not alter the template.

Reminders are normalized from task reminder offsets or custom timestamps within the mutation transaction. A protected minute cron claims due deliveries with SKIP LOCKED and leases, sends Web Push, retires expired subscriptions and retries transient failures. Web Push has at-least-once delivery; deterministic notification tags collapse duplicates. An active subscription alone does not prove a healthy scheduler; UI reports scheduling and delivery separately.

Deployment: Vercel + Supabase; HTTPS; minute cron requires a compatible Vercel plan or external scheduler. No production secrets are committed. Public release requires real-provider auth, RLS, cron and device checks listed in RELEASE.md.
