import { z } from "zod";
import { DateTime } from "luxon";
export const priorityLabels = ["No priority", "Low", "Medium", "High"];
export const zoneSchema = z
  .string()
  .refine((v) => DateTime.now().setZone(v).isValid, "Choose a valid timezone");
const timestamp = z.string().datetime({ offset: true }).nullable();
export const taskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).default(""),
    priority: z.number().int().min(0).max(3),
    list_id: z.string().uuid().nullable(),
    scheduled_at: timestamp,
    due_at: timestamp,
    timezone: zoneSchema,
    reminder_offsets: z.array(z.number().int().min(0).max(525600)).max(10),
    custom_reminders: z.array(z.string().datetime({ offset: true })).max(10),
    status: z.enum(["open", "completed"]),
    position: z.number().int().min(0).max(2147483647),
    recurrence: z
      .object({
        frequency: z.enum([
          "daily",
          "weekdays",
          "weekly",
          "monthly",
          "yearly",
          "custom",
        ]),
        interval: z.number().int().min(1).max(365),
        weekdays: z.array(z.number().int().min(1).max(7)).max(7),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.recurrence || v.reminder_offsets.length) &&
      !v.scheduled_at &&
      !v.due_at
    )
      c.addIssue({
        code: "custom",
        message: "Set a date and time for repeats or reminders",
      });
    if (v.recurrence?.frequency === "custom" && !v.recurrence.weekdays.length)
      c.addIssue({ code: "custom", message: "Choose at least one weekday" });
  });
export type TaskInput = z.infer<typeof taskSchema>;
export type Task = TaskInput & {
  id: string;
  user_id: string;
  version: number;
  deleted_at: string | null;
  completed_at: string | null;
  series_id: string | null;
  occurrence_index: number;
  created_at: string;
  updated_at: string;
};
export type List = {
  id: string;
  user_id: string;
  name: string;
  position: number;
  version: number;
  deleted_at: string | null;
};
export type Profile = {
  display_name: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  week_start: number;
  locale: string;
  version: number;
};
export type Snapshot = {
  tasks: Task[];
  lists: List[];
  profile: Profile | null;
  reminders: {
    id: string;
    task_id: string;
    status: string;
    reminder_at: string;
  }[];
  pushCount: number;
  schedulerHealthy: boolean;
};
export const mutationSchema = z
  .object({
    id: z.string().uuid(),
    entity: z.enum(["task", "list", "profile"]),
    action: z.enum(["put", "delete"]),
    record_id: z.string().uuid(),
    expected_version: z.number().int().min(0),
    scope: z.enum(["one", "future", "series"]).default("one"),
    data: z.unknown(),
  })
  .strict()
  .superRefine((m, c) => {
    if (m.action === "delete" && m.entity === "profile")
      c.addIssue({ code: "custom", message: "Use account deletion" });
    if (m.action === "put") {
      const s =
        m.entity === "task"
          ? taskSchema
          : m.entity === "list"
            ? z
                .object({
                  name: z.string().trim().min(1).max(80),
                  position: z.number().int().min(0).max(2147483647),
                })
                .strict()
            : z
                .object({
                  display_name: z.string().max(80),
                  timezone: zoneSchema,
                  theme: z.enum(["light", "dark", "system"]),
                  week_start: z.number().int().min(0).max(1),
                  locale: z
                    .string()
                    .max(40)
                    .refine((v) => {
                      try {
                        new Intl.DateTimeFormat(v);
                        return true;
                      } catch {
                        return false;
                      }
                    }),
                })
                .strict();
      const r = s.safeParse(m.data);
      if (!r.success)
        c.addIssue({ code: "custom", message: r.error.issues[0].message });
    }
  });
export type Mutation = z.infer<typeof mutationSchema>;
export function localToUTC(value: string, zone: string) {
  if (!value) return null;
  const d = DateTime.fromISO(value, { zone });
  if (!d.isValid || d.toFormat("yyyy-MM-dd'T'HH:mm") !== value)
    throw Error("This local time does not exist in the selected timezone");
  if (d.getPossibleOffsets().length > 1)
    throw Error(
      "This time occurs twice because clocks change. Choose a time outside the repeated hour.",
    );
  return d.toUTC().toISO();
}
export function nextOccurrence(
  iso: string,
  zone: string,
  rule: NonNullable<TaskInput["recurrence"]>,
) {
  let d = DateTime.fromISO(iso).setZone(zone);
  const day = d.day;
  if (rule.frequency === "monthly")
    d = d.plus({ months: rule.interval }).set({
      day: Math.min(day, d.plus({ months: rule.interval }).daysInMonth!),
    });
  else if (rule.frequency === "yearly") d = d.plus({ years: rule.interval });
  else if (rule.frequency === "weekly") d = d.plus({ weeks: rule.interval });
  else if (rule.frequency === "daily") d = d.plus({ days: rule.interval });
  else {
    do {
      d = d.plus({ days: 1 });
    } while (
      !(
        rule.frequency === "weekdays" ? [1, 2, 3, 4, 5] : rule.weekdays
      ).includes(d.weekday)
    );
  }
  return d.toUTC().toISO()!;
}
export function reminderTimes(task: TaskInput) {
  const base = task.scheduled_at || task.due_at;
  return [
    ...new Set([
      ...task.custom_reminders,
      ...(base
        ? task.reminder_offsets.map((m) =>
            DateTime.fromISO(base).minus({ minutes: m }).toUTC().toISO()!,
          )
        : []),
    ]),
  ].sort();
}
export function isOverdue(
  task: Pick<Task, "status" | "due_at">,
  now = Date.now(),
) {
  return (
    task.status === "open" && !!task.due_at && Date.parse(task.due_at) < now
  );
}
export function emptyTask(
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): TaskInput {
  return {
    title: "",
    description: "",
    priority: 0,
    list_id: null,
    scheduled_at: null,
    due_at: null,
    timezone: zone,
    reminder_offsets: [],
    custom_reminders: [],
    status: "open",
    position: 0,
    recurrence: null,
  };
}
