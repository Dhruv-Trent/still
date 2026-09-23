# Database structure

| Table                | Ownership and purpose                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.users`         | Supabase-managed identity; application never stores passwords                                                                                                             |
| `profiles`           | User PK, display name, IANA timezone, locale, appearance, week start, version                                                                                             |
| `task_lists`         | UUID, owner, name, position, optimistic version, deletion tombstone                                                                                                       |
| `task_series`        | Owner, recurrence template, anchor index, active flag, expansion cursor timestamp                                                                                         |
| `tasks`              | Owner, title/notes, priority/status, list, scheduled/due/completed UTC timestamps, IANA timezone, position, reminder choices, series/occurrence index, version, tombstone |
| `reminders`          | Owned task FK, exact send time, delivery state, attempts, lease, sent time                                                                                                |
| `push_subscriptions` | Owner, endpoint, minimum encryption material                                                                                                                              |
| `mutation_receipts`  | Owner, UUID idempotency key, payload and acknowledgement                                                                                                                  |
| `rate_limits`        | Server-only bucket counters; no client access                                                                                                                             |
| `scheduler_health`   | Server-only last scheduler claim timestamp                                                                                                                                |

Every public application table has RLS enabled. Authenticated clients receive SELECT only on their records. No anonymous SELECT or writes are granted. All direct authenticated table writes are revoked. The security-definer mutation RPC checks `auth.uid()`, owner, allowed action/entity, exact data fields, foreign-key ownership, version and tombstone state. It uses a fixed empty search path and qualifies all application tables. UUID collisions with another user's resource fail closed.

Composite `(id,user_id)` foreign keys prevent assigning another account's list, series or task. User deletion cascades through all application data, including delivery subscriptions and mutation receipts. List deletion moves tasks to Inbox and clears the list from series templates.

`(series_id,occurrence_index)` and `(task_id,reminder_at)` uniqueness prevent duplicate occurrences and duplicate schedules. Idempotency keys bind to the full mutation payload; reusing an ID with a different payload is rejected. Receipt/tombstone retention lasts until account deletion in this release, protecting long-offline clients; define and document a bounded offline-retention policy before pruning them.

Read RLS and explicit mutation checks are independent security layers. Privileged job/RPC grants are service-role only. Realtime publication includes tasks, lists, and profiles and relies on subscriber SELECT policies.
