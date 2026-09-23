# Verification report

Verified locally on 22 September 2026 using Node.js 24.19.0.

| Check                                                            | Result                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Clean `npm ci --include=dev` from the repaired lockfile          | Passed                                                                                                            |
| Strict TypeScript                                                | Passed                                                                                                            |
| ESLint                                                           | Passed                                                                                                            |
| Prettier check                                                   | Passed                                                                                                            |
| Production Next.js build                                         | Passed; application routes compiled and static pages generated                                                    |
| Unit/business tests                                              | 16 passed                                                                                                         |
| Real PostgreSQL/PGlite migration and integration tests           | 24 passed                                                                                                         |
| Playwright public-page tests                                     | 10 passed                                                                                                         |
| Playwright actual workspace component tests with test-only state | 3 passed                                                                                                          |
| Native browser IndexedDB isolation/queue test                    | 1 passed                                                                                                          |
| npm advisory audit                                               | 0 known vulnerabilities reported                                                                                  |
| Source pattern review for credentials                            | No real credentials found; the only broad service-role-pattern match was the synthetic PostgreSQL test-role setup |

The browser suite scheduled 21 test/project combinations: 14 passed and 7 skipped. Three skipped cases are the **unrun real authenticated journey** (one per viewport), because no live Supabase account/configuration was supplied. Four skips avoid repeating the viewport matrix and native storage test in multiple projects.

Browser coverage includes desktop, iPhone and iPad emulation; public widths 320, 375, 430, 768, 1024, 1440 and 1920 pixels; light/dark axe checks; protected API denial without authentication; PWA manifest/icons; offline-shell/static caching without private API caching; task create/edit/complete/restore interactions; list creation; calendar controls; and appearance changes. Component tests are not evidence of live Auth or server sync. Screenshots are saved under `docs/screenshots`; the workspace screenshot uses test fixture data.

Database coverage includes explicit User B attempts against User A resources, direct write denial, owner foreign keys, idempotency, stale versions, tombstones, recurrence scope and anchors, DST behavior, future expansion, reminder leases/retries/cancellation, immutable subscription ownership, durable rate limits and account cascades.

Not verified here: hosted Supabase Auth/SMTP, real email verification/recovery, actual Web Push receipt with the app closed, real-device cross-account/cross-device synchronization, installed Safari/iOS/Android offline behavior, hosted account deletion, capacity/load tests, backup restoration, Vercel cron execution, custom domain/HTTPS deployment, or legal approval. Complete `RELEASE.md` before public launch.

This report is evidence of the listed local checks, not a production-readiness or security certification.
