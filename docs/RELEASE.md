# Release verification and deployment gate

This file distinguishes implemented behavior, local evidence, and outstanding provider/device verification. Source code being present is not evidence of a working production service.

## Local verification

The accompanying implementation has been checked with strict TypeScript, ESLint, PostgreSQL/PGlite integration tests, business-logic tests, a production build, npm advisory audit, Playwright and axe. Final totals/results are recorded in `VERIFICATION.md`.

Database tests execute the shipped migration and check:

- Anonymous denial, cross-account read denial, direct write denial, and manual foreign-resource mutation attempts.
- Tasks, lists, reminders, profiles, subscriptions and privileged scheduler RPCs.
- Task creation/edit/completion/restoration/deletion, list rename/removal, idempotency and stale versions.
- DST, monthly anchors, repeated completion, single exceptions, one/future/series operations, restart after stopping recurrence, and future expansion.
- Due claims, lease recovery, exhausted attempts, cancellation, subscription ownership and account cascades.

Browser tests distinguish public pages and **test-only component fixtures** from real-provider end-to-end tests. Fixtures mount the actual workspace components with deterministic state; they do not prove authentication, server synchronization, or notification delivery. The native IndexedDB test uses the real browser storage implementation.

## Required before opening public signup

- [ ] Deploy a dedicated Supabase project; apply migrations; verify RLS and grants on the hosted database.
- [ ] Repeat manual REST/RPC cross-user attacks with two real Supabase JWTs. Test tasks, lists, profiles, reminders and subscriptions. Expected: no rows or explicit denial, never another user's content.
- [ ] Configure Auth email confirmation, minimum password length, sign-in/email quotas, verified SMTP sender, exact HTTPS callback URLs and infrastructure abuse controls.
- [ ] Sign up with a real email, verify it, sign in/out, request a password reset, open the link in the initiating browser, change the password, and verify old credentials fail.
- [ ] Set all server/public environment variables, stable VAPID keys and random cron secret. Confirm no server secret appears in static assets, logs, Git or source maps.
- [ ] Enable the authenticated minute scheduler. Check health freshness, server logs, delivery delay and recurrence lookahead.
- [ ] Enable push on supported desktop browsers and installed iOS/Android devices. Close the app and receive a real reminder. Test denied permission, disabled browser notifications, expired subscriptions and retries.
- [ ] Use a verified disposable account to run the authenticated Playwright journey with `E2E_EMAIL` and `E2E_PASSWORD`. The current suite's live task journey expects an already verified account; signup/email/recovery acceptance is manual.
- [ ] Create a task on one real device, complete/edit it on another, and check realtime/poll reconciliation.
- [ ] Install the PWA; after first successful service-worker installation, disconnect, reload the workspace, create/complete/edit tasks, reconnect and verify persistence with no duplicates. Test expired-session offline handling and browser storage denial.
- [ ] Create a conflicting offline edit on each of two devices. Resolve both choices deliberately; confirm no silent overwrite or resurrection.
- [ ] Verify keyboard tab order, screen-reader labels, dialog focus restoration, mobile menu and 200% text zoom on the authenticated product. Automated axe checks are only part of accessibility verification.
- [ ] Test an iPhone, iPad and Android installation plus macOS/Windows browsers. Chromium viewport emulation is not Safari/WebKit or actual-device certification.
- [ ] Delete a disposable account after password verification; verify its live records and subscriptions disappear. Document backup/log retention separately.
- [ ] Replace privacy/terms/security-reporting placeholders with operator-specific reviewed text.
- [ ] Establish backups, restore tests, operational alerts, capacity limits and dependency updates. Load-test reminder processing for the intended scale.

## Known limits and deliberate behavior

- Native social sign-in, attachments, collaboration, subtasks and drag-and-drop are not included. Core ordering/rescheduling use explicit controls.
- Offline access requires cached application assets and an available local session. Expired sessions can require reconnection; browser storage can be evicted. Site data is not separately encrypted.
- A snapshot supports fewer than 10,000 live tasks and 1,000 lists per account. Explicit errors stop truncation. Reads are paginated and eventually reconcile if data changes between pages.
- Recurrence expands roughly 32 days ahead, 100 series/cron tick, up to 64 new occurrences per series per tick. Large historical backlogs take multiple ticks. Series lookup should be profiled before very large deployments.
- Daily/weekly/monthly/yearly intervals and selected weekdays are supported. Arbitrary RFC 5545 rules are not exposed.
- Recurrence uses the stored IANA timezone. Automatic DST gaps shift forward and folds use PostgreSQL's standard-time interpretation; the next occurrence resumes its original wall-time anchor. Manual entry rejects nonexistent or ambiguous local times with an explanation.
- Offset reminders repeat. A custom absolute reminder belongs to that occurrence. Scheduling a reminder more than an hour in the past marks it missed.
- Push is at least once with generic payloads, up to 10 registered devices/account, five attempts, five-minute leases, bounded runtime and notification tags. OS restrictions and outages can prevent delivery. Scheduler health indicates recent processing, not a delivery guarantee.
- The server rechecks task/reminder state before sending; an edit racing after that check can still result in one obsolete generic notification.
- Deleted tasks and mutation receipts are retained for conflict/idempotency safety until account deletion. Add an explicit offline-age policy before pruning them.
- CSP currently permits inline scripts/styles for Next's static hydration and offline shell. Do not add untrusted HTML; consider a tested nonce-based dynamic architecture if requirements change.
- This handoff does not include a live Supabase project, SMTP account, Vercel deployment, custom domain, production secrets, or completed legal review.

## Reproducible component tests

```sh
npm run test:ui:serve
# Separate terminal, with the main app also running for the public tests:
E2E_COMPONENTS=1 npm run test:e2e
```

The fixture server is bound to localhost:3001 and is not a production route. `tests/fixtures` must never be deployed as an independent public service.
