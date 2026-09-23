import { describe, it, expect } from "vitest";
import {
  emptyTask,
  taskSchema,
  localToUTC,
  nextOccurrence,
  reminderTimes,
  isOverdue,
  mutationSchema,
} from "../lib/model";
import { pushSchema } from "../lib/push-validation";
import { project } from "../lib/offline";
describe("dates and reminders", () => {
  it("converts local time with an IANA zone", () =>
    expect(localToUTC("2026-10-20T15:00", "Asia/Kolkata")).toBe(
      "2026-10-20T09:30:00.000Z",
    ));
  it("rejects a nonexistent spring-forward time", () =>
    expect(() => localToUTC("2026-03-08T02:30", "America/New_York")).toThrow());
  it("rejects an ambiguous fall-back time", () =>
    expect(() => localToUTC("2026-11-01T01:30", "America/New_York")).toThrow());
  it("preserves wall time across DST", () =>
    expect(
      nextOccurrence("2026-03-07T14:00:00Z", "America/New_York", {
        frequency: "daily",
        interval: 1,
        weekdays: [],
      }),
    ).toBe("2026-03-08T13:00:00.000Z"));
  it("clamps month end", () =>
    expect(
      nextOccurrence("2026-01-31T09:00:00Z", "UTC", {
        frequency: "monthly",
        interval: 1,
        weekdays: [],
      }),
    ).toBe("2026-02-28T09:00:00.000Z"));
  it("skips weekends", () =>
    expect(
      nextOccurrence("2026-09-25T09:00:00Z", "UTC", {
        frequency: "weekdays",
        interval: 1,
        weekdays: [],
      }),
    ).toBe("2026-09-28T09:00:00.000Z"));
  it("uses custom weekdays", () =>
    expect(
      nextOccurrence("2026-09-21T09:00:00Z", "UTC", {
        frequency: "custom",
        interval: 1,
        weekdays: [3, 5],
      }),
    ).toBe("2026-09-23T09:00:00.000Z"));
  it("deduplicates reminder times", () =>
    expect(
      reminderTimes({
        ...emptyTask(),
        title: "Dentist",
        scheduled_at: "2026-10-20T10:00:00.000Z",
        reminder_offsets: [60, 60, 10],
      }),
    ).toEqual(["2026-10-20T09:00:00.000Z", "2026-10-20T09:50:00.000Z"]));
  it("only marks past-due open tasks overdue", () => {
    expect(isOverdue({ status: "open", due_at: "2020-01-01T00:00:00Z" })).toBe(
      true,
    );
    expect(
      isOverdue({ status: "completed", due_at: "2020-01-01T00:00:00Z" }),
    ).toBe(false);
    expect(isOverdue({ status: "open", due_at: null })).toBe(false);
  });
});
describe("input boundaries", () => {
  it("accepts title-only tasks", () =>
    expect(
      taskSchema.safeParse({ ...emptyTask(), title: "Hello" }).success,
    ).toBe(true));
  it("rejects unexpected fields and empty titles", () => {
    expect(
      taskSchema.safeParse({ ...emptyTask(), title: "x", user_id: "attacker" })
        .success,
    ).toBe(false);
    expect(taskSchema.safeParse(emptyTask()).success).toBe(false);
  });
  it("requires schedule for offset reminders", () =>
    expect(
      taskSchema.safeParse({
        ...emptyTask(),
        title: "x",
        reminder_offsets: [5],
      }).success,
    ).toBe(false));
  it("rejects custom repeat without days", () =>
    expect(
      taskSchema.safeParse({
        ...emptyTask(),
        title: "x",
        scheduled_at: "2026-10-20T10:00:00Z",
        recurrence: { frequency: "custom", interval: 1, weekdays: [] },
      }).success,
    ).toBe(false));
  it("rejects unknown mutation fields", () =>
    expect(
      mutationSchema.safeParse({
        id: crypto.randomUUID(),
        entity: "task",
        action: "put",
        record_id: crypto.randomUUID(),
        expected_version: 0,
        data: { ...emptyTask(), title: "x" },
        user_id: "bad",
      }).success,
    ).toBe(false));
  it("rejects SSRF push endpoints", () => {
    for (const endpoint of [
      "https://127.0.0.1/push",
      "http://fcm.googleapis.com/",
      "https://fcm.googleapis.com.evil.test/",
      "https://fcm.googleapis.com:1234/",
    ])
      expect(
        pushSchema.safeParse({
          endpoint,
          keys: { p256dh: "a".repeat(87), auth: "a".repeat(22) },
        }).success,
      ).toBe(false);
  });
});
describe("offline projection", () => {
  it("keeps queued creates and completion visible", () => {
    const id = crypto.randomUUID();
    const data = { ...emptyTask(), title: "Offline task" };
    const result = project({
      snapshot: {
        tasks: [],
        lists: [],
        profile: null,
        reminders: [],
        pushCount: 0,
        schedulerHealthy: false,
      },
      queue: [
        {
          id: crypto.randomUUID(),
          entity: "task",
          action: "put",
          record_id: id,
          expected_version: 0,
          scope: "one",
          data,
        },
        {
          id: crypto.randomUUID(),
          entity: "task",
          action: "put",
          record_id: id,
          expected_version: 1,
          scope: "one",
          data: { ...data, status: "completed" },
        },
      ],
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].status).toBe("completed");
    expect(result.tasks[0].version).toBe(2);
  });
});
