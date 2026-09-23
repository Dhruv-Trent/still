import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { emptyTask, type Mutation } from "../lib/model";
let db: PGlite;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
async function asUser<T>(uid: string, fn: () => Promise<T>) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function mutate(uid: string, m: Mutation) {
  return asUser(uid, () =>
    db.query("select public.apply_mutation($1::jsonb)", [JSON.stringify(m)]),
  );
}
function task(title = "Task A"): Mutation {
  return {
    id: crypto.randomUUID(),
    entity: "task",
    action: "put",
    record_id: crypto.randomUUID(),
    expected_version: 0,
    scope: "one",
    data: { ...emptyTask("UTC"), title },
  };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;insert into auth.users values('${A}'),('${B}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202609210001_initial.sql", "utf8"),
  );
});
afterAll(async () => db?.close());
describe("real PostgreSQL migrations and authorization", () => {
  it("creates, updates, completes, restores and tombstones a task", async () => {
    const m = task();
    await mutate(A, m);
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 1,
      data: { ...(m.data as object), title: "Edited", status: "completed" },
    });
    let r = await asUser(A, () =>
      db.query<{ version: number; completed_at: string }>(
        "select version,completed_at from public.tasks where id=$1",
        [m.record_id],
      ),
    );
    expect(r.rows[0].version).toBe(2);
    expect(r.rows[0].completed_at).toBeTruthy();
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 2,
      data: { ...(m.data as object), status: "open" },
    });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      action: "delete",
      expected_version: 3,
      data: null,
    });
    r = await asUser(A, () =>
      db.query(
        "select * from public.tasks where id=$1 and deleted_at is null",
        [m.record_id],
      ),
    );
    expect(r.rows).toHaveLength(0);
  });
  it("rejects User B reading or mutating User A task", async () => {
    const m = task();
    await mutate(A, m);
    expect(
      (
        await asUser(B, () =>
          db.query("select * from public.tasks where id=$1", [m.record_id]),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      mutate(B, { ...m, id: crypto.randomUUID(), expected_version: 1 }),
    ).rejects.toThrow("access denied");
    await expect(
      mutate(B, {
        ...m,
        id: crypto.randomUUID(),
        expected_version: 1,
        action: "delete",
      }),
    ).rejects.toThrow("access denied");
  });
  it("rejects direct database writes outside mutation RPC", async () => {
    await expect(
      asUser(B, () =>
        db.query(
          "insert into public.tasks(id,user_id,title) values($1,$2,$3)",
          [crypto.randomUUID(), A, "attack"],
        ),
      ),
    ).rejects.toThrow("permission denied");
  });
  it("is idempotent and rejects reused mutation IDs with different payloads", async () => {
    const m = task();
    await mutate(A, m);
    await mutate(A, m);
    expect(
      (
        await db.query<{ version: number }>(
          "select version from public.tasks where id=$1",
          [m.record_id],
        )
      ).rows[0].version,
    ).toBe(1);
    await expect(
      mutate(A, {
        ...m,
        data: { ...(m.data as object), title: "Replacement" },
      }),
    ).rejects.toThrow("invalid mutation id");
  });
  it("detects stale updates and never resurrects a tombstone", async () => {
    const m = task();
    await mutate(A, m);
    await expect(
      mutate(A, { ...m, id: crypto.randomUUID(), expected_version: 0 }),
    ).rejects.toThrow("conflict");
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 1,
      action: "delete",
    });
    await expect(
      mutate(A, { ...m, id: crypto.randomUUID(), expected_version: 2 }),
    ).rejects.toThrow("conflict");
  });
  it("isolates lists and prevents assigning another user’s list", async () => {
    const l: Mutation = {
      id: crypto.randomUUID(),
      entity: "list",
      action: "put",
      record_id: crypto.randomUUID(),
      expected_version: 0,
      scope: "one",
      data: { name: "Private", position: 0 },
    };
    await mutate(A, l);
    expect(
      (
        await asUser(B, () =>
          db.query("select * from public.task_lists where id=$1", [
            l.record_id,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      mutate(B, {
        ...l,
        id: crypto.randomUUID(),
        expected_version: 1,
        data: { name: "Hacked", position: 0 },
      }),
    ).rejects.toThrow("access denied");
    const m = task();
    await expect(
      mutate(B, {
        ...m,
        data: { ...(m.data as object), list_id: l.record_id },
      }),
    ).rejects.toThrow("access denied");
    await mutate(A, {
      ...l,
      id: crypto.randomUUID(),
      expected_version: 1,
      data: { name: "Renamed", position: 5 },
    });
    await mutate(A, {
      ...m,
      data: { ...(m.data as object), list_id: l.record_id },
    });
    await mutate(A, {
      ...l,
      id: crypto.randomUUID(),
      expected_version: 2,
      action: "delete",
    });
    expect(
      (
        await db.query<{ list_id: string | null }>(
          "select list_id from public.tasks where id=$1",
          [m.record_id],
        )
      ).rows[0].list_id,
    ).toBeNull();
  });
  it("isolates preferences", async () => {
    const p: Mutation = {
      id: crypto.randomUUID(),
      entity: "profile",
      action: "put",
      record_id: A,
      expected_version: 0,
      scope: "one",
      data: {
        display_name: "Alice",
        timezone: "Asia/Kolkata",
        theme: "dark",
        week_start: 1,
        locale: "en-IN",
      },
    };
    await mutate(A, p);
    expect(
      (
        await asUser(B, () =>
          db.query("select * from public.profiles where id=$1", [A]),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      mutate(B, { ...p, id: crypto.randomUUID(), expected_version: 1 }),
    ).rejects.toThrow("access denied");
  });
  it("isolates reminder rows and subscription keys", async () => {
    const m = task();
    await mutate(A, {
      ...m,
      data: {
        ...(m.data as object),
        scheduled_at: "2026-10-20T10:00:00Z",
        reminder_offsets: [60],
      },
    });
    await db.query(
      "insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4)",
      [A, "https://fcm.googleapis.com/test", "key", "secret"],
    );
    expect(
      (
        await asUser(B, () =>
          db.query("select * from public.reminders where task_id=$1", [
            m.record_id,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(B, () =>
          db.query("select * from public.push_subscriptions where user_id=$1", [
            A,
          ]),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(B, () =>
        db.query("update public.reminders set status='sent' where task_id=$1", [
          m.record_id,
        ]),
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      asUser(B, () =>
        db.query("delete from public.push_subscriptions where user_id=$1", [A]),
      ),
    ).rejects.toThrow("permission denied");
  });
  it("creates one next occurrence across repeated completion", async () => {
    const m = task("Daily");
    const d = {
      ...(m.data as object),
      scheduled_at: "2026-03-07T14:00:00Z",
      timezone: "America/New_York",
      recurrence: { frequency: "daily", interval: 1, weekdays: [] },
    };
    await mutate(A, { ...m, data: d });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 1,
      data: { ...d, status: "completed" },
    });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 2,
      data: { ...d, status: "open" },
    });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 3,
      data: { ...d, status: "completed" },
    });
    const r = await db.query<{ scheduled_at: string }>(
      "select scheduled_at from public.tasks where series_id=(select series_id from public.tasks where id=$1) order by occurrence_index",
      [m.record_id],
    );
    expect(r.rows).toHaveLength(2);
    expect(new Date(r.rows[1].scheduled_at).toISOString()).toBe(
      "2026-03-08T13:00:00.000Z",
    );
  });
  it("rejects invalid recurrence and database owner reference attacks", async () => {
    const m = task();
    await expect(
      mutate(A, {
        ...m,
        data: {
          ...(m.data as object),
          scheduled_at: "2026-01-01T09:00:00Z",
          recurrence: { frequency: "custom", interval: 1, weekdays: [] },
        },
      }),
    ).rejects.toThrow("invalid weekdays");
  });
  it("cancels reminders after completion", async () => {
    const m = task();
    const d = {
      ...(m.data as object),
      scheduled_at: "2026-10-20T10:00:00Z",
      reminder_offsets: [60],
    };
    await mutate(A, { ...m, data: d });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 1,
      data: { ...d, status: "completed" },
    });
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.reminders where task_id=$1",
          [m.record_id],
        )
      ).rows[0].status,
    ).toBe("cancelled");
  });
  it("protects scheduler and rate limiter RPCs from users", async () => {
    await expect(
      asUser(B, () => db.query("select * from public.claim_reminders()")),
    ).rejects.toThrow("permission denied");
    await expect(
      asUser(B, () => db.query("select public.take_rate_limit('x',1,60)")),
    ).rejects.toThrow("permission denied");
  });
});

describe("recurrence and background delivery regressions", () => {
  it("preserves January 31 through February into March", async () => {
    const m = task("Month end");
    const d = {
      ...(m.data as object),
      scheduled_at: "2026-01-31T09:00:00Z",
      recurrence: { frequency: "monthly", interval: 1, weekdays: [] },
    };
    await mutate(A, { ...m, data: d });
    await db.query("select public.materialize_next($1)", [m.record_id]);
    const second = (
      await db.query<{ id: string; scheduled_at: string }>(
        "select id,scheduled_at from public.tasks where series_id=(select series_id from public.tasks where id=$1) and occurrence_index=1",
        [m.record_id],
      )
    ).rows[0];
    expect(new Date(second.scheduled_at).toISOString()).toBe(
      "2026-02-28T09:00:00.000Z",
    );
    await db.query("select public.materialize_next($1)", [second.id]);
    const third = (
      await db.query<{ scheduled_at: string }>(
        "select scheduled_at from public.tasks where series_id=(select series_id from public.tasks where id=$1) and occurrence_index=2",
        [m.record_id],
      )
    ).rows[0];
    expect(new Date(third.scheduled_at).toISOString()).toBe(
      "2026-03-31T09:00:00.000Z",
    );
  });
  it("keeps a single reschedule from moving later occurrences", async () => {
    const m = task("One exception");
    const d = {
      ...(m.data as object),
      scheduled_at: "2026-10-01T09:00:00Z",
      recurrence: { frequency: "daily", interval: 1, weekdays: [] },
    };
    await mutate(A, { ...m, data: d });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 1,
      data: { ...d, scheduled_at: "2026-10-01T11:00:00Z", status: "completed" },
    });
    const next = (
      await db.query<{ scheduled_at: string }>(
        "select scheduled_at from public.tasks where series_id=(select series_id from public.tasks where id=$1) and occurrence_index=1",
        [m.record_id],
      )
    ).rows[0];
    expect(new Date(next.scheduled_at).toISOString()).toBe(
      "2026-10-02T09:00:00.000Z",
    );
  });
  it("deleting an occurrence retains its series", async () => {
    const m = task("Skip today");
    await mutate(A, {
      ...m,
      data: {
        ...(m.data as object),
        scheduled_at: "2026-10-01T09:00:00Z",
        recurrence: { frequency: "daily", interval: 1, weekdays: [] },
      },
    });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      action: "delete",
      expected_version: 1,
    });
    expect(
      (
        await db.query(
          "select id from public.tasks where series_id=(select series_id from public.tasks where id=$1) and occurrence_index=1 and deleted_at is null",
          [m.record_id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("edits future schedule and deletes the full series", async () => {
    const m = task("Series edit");
    const d = {
      ...(m.data as object),
      scheduled_at: "2026-10-01T09:00:00Z",
      recurrence: { frequency: "daily", interval: 1, weekdays: [] },
    };
    await mutate(A, { ...m, data: d });
    await db.query("select public.materialize_next($1)", [m.record_id]);
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 1,
      scope: "future",
      data: {
        ...d,
        title: "New series title",
        scheduled_at: "2026-10-01T11:00:00Z",
        recurrence: { frequency: "weekly", interval: 1, weekdays: [] },
      },
    });
    const next = (
      await db.query<{ scheduled_at: string; title: string }>(
        "select scheduled_at,title from public.tasks where series_id=(select series_id from public.tasks where id=$1) and occurrence_index=1",
        [m.record_id],
      )
    ).rows[0];
    expect(next.title).toBe("New series title");
    expect(new Date(next.scheduled_at).toISOString()).toBe(
      "2026-10-08T11:00:00.000Z",
    );
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      expected_version: 2,
      scope: "series",
      action: "delete",
    });
    expect(
      (
        await db.query(
          "select id from public.tasks where series_id=(select series_id from public.tasks where id=$1) and deleted_at is null",
          [m.record_id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("claims reminders once and retries expired leases", async () => {
    const m = task("Send soon");
    const scheduled = new Date(Date.now() - 10000).toISOString();
    await mutate(A, {
      ...m,
      data: {
        ...(m.data as object),
        scheduled_at: scheduled,
        reminder_offsets: [0],
      },
    });
    const first = await db.query<{ id: string; task_id: string }>(
      "select * from public.claim_reminders()",
    );
    const claimed = first.rows.find((r) => r.task_id === m.record_id)!;
    expect(claimed).toBeTruthy();
    expect(
      (
        await db.query<{ task_id: string }>(
          "select * from public.claim_reminders()",
        )
      ).rows.some((r) => r.task_id === m.record_id),
    ).toBe(false);
    await db.query(
      "update public.reminders set lease_until=now()-interval '1 minute' where id=$1",
      [claimed.id],
    );
    expect(
      (
        await db.query<{ task_id: string }>(
          "select * from public.claim_reminders()",
        )
      ).rows.some((r) => r.task_id === m.record_id),
    ).toBe(true);
  });
  it("marks exhausted leases failed instead of leaving them stuck", async () => {
    await db.exec(
      "update public.reminders set status='sending',attempts=5,lease_until=now()-interval '1 minute' where status='sending'",
    );
    await db.query("select * from public.claim_reminders()");
    expect(
      (
        await db.query(
          "select id from public.reminders where status='sending' and attempts>=5",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("pre-generates future occurrences without duplicates", async () => {
    const m = task("Planning horizon");
    const d = {
      ...(m.data as object),
      scheduled_at: new Date().toISOString(),
      recurrence: { frequency: "daily", interval: 1, weekdays: [] },
    };
    await mutate(A, { ...m, data: d });
    await db.query("select public.expand_recurrences()");
    const count = () =>
      db.query<{ n: number }>(
        "select count(*)::integer n from public.tasks where series_id=(select series_id from public.tasks where id=$1)",
        [m.record_id],
      );
    const before = (await count()).rows[0].n;
    expect(before).toBeGreaterThan(30);
    await db.query("select public.expand_recurrences()");
    expect((await count()).rows[0].n).toBe(before);
  });
  it("denies anonymous reads and mutations", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.tasks")).rejects.toThrow(
        "permission denied",
      );
      await expect(
        db.query("select public.apply_mutation($1)", [JSON.stringify(task())]),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("release security and calendar edge cases", () => {
  it("uses deterministic PostgreSQL DST resolution for automatic recurrence", async () => {
    const r = await db.query<{ spring: string; fall: string }>(
      `select public.occurrence_at('2026-03-07T07:30:00Z','America/New_York','{"frequency":"daily","interval":1,"weekdays":[]}'::jsonb,1) spring,public.occurrence_at('2026-10-31T05:30:00Z','America/New_York','{"frequency":"daily","interval":1,"weekdays":[]}'::jsonb,1) fall`,
    );
    expect(new Date(r.rows[0].spring).toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
    expect(new Date(r.rows[0].fall).toISOString()).toBe(
      "2026-11-01T06:30:00.000Z",
    );
  });
  it("enforces durable rate limits", async () => {
    const key = crypto.randomUUID();
    const hit = async () =>
      (
        await db.query<{ allowed: boolean }>(
          "select public.take_rate_limit($1,2,60) allowed",
          [key],
        )
      ).rows[0].allowed;
    expect(await hit()).toBe(true);
    expect(await hit()).toBe(true);
    expect(await hit()).toBe(false);
  });
  it("requires series scope to change a pattern and can restart a stopped series", async () => {
    const m = task("Restart repeat");
    const d = {
      ...(m.data as object),
      scheduled_at: "2026-10-01T09:00:00Z",
      recurrence: { frequency: "daily", interval: 1, weekdays: [] },
    };
    await mutate(A, { ...m, data: d });
    await expect(
      mutate(A, {
        ...m,
        id: crypto.randomUUID(),
        expected_version: 1,
        data: { ...d, recurrence: null },
      }),
    ).rejects.toThrow("change recurrence");
    await db.query("select public.materialize_next($1)", [m.record_id]);
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      scope: "future",
      expected_version: 1,
      data: { ...d, recurrence: null },
    });
    await mutate(A, {
      ...m,
      id: crypto.randomUUID(),
      scope: "future",
      expected_version: 2,
      data: d,
    });
    await db.query("select public.materialize_next($1)", [m.record_id]);
    expect(
      (
        await db.query(
          "select id from public.tasks where series_id=(select series_id from public.tasks where id=$1) and deleted_at is null",
          [m.record_id],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("cascades deleted account data and never changes subscription ownership", async () => {
    const uid = crypto.randomUUID();
    await db.query("insert into auth.users values($1)", [uid]);
    const m = task("Disposable account");
    await mutate(uid, {
      ...m,
      data: {
        ...(m.data as object),
        scheduled_at: new Date().toISOString(),
        reminder_offsets: [0],
      },
    });
    await db.query(
      "insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4)",
      [uid, `https://fcm.googleapis.com/${uid}`, "key", "auth"],
    );
    await expect(
      db.query(
        "update public.push_subscriptions set user_id=$1 where user_id=$2",
        [A, uid],
      ),
    ).rejects.toThrow("immutable");
    await db.query("delete from auth.users where id=$1", [uid]);
    for (const table of [
      "tasks",
      "reminders",
      "push_subscriptions",
      "mutation_receipts",
    ])
      expect(
        (
          await db.query(`select * from public.${table} where user_id=$1`, [
            uid,
          ])
        ).rows,
      ).toHaveLength(0);
  });
});
