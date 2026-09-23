"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { DateTime } from "luxon";
import { X, ChevronDown, CalendarDays } from "lucide-react";
import {
  emptyTask,
  localToUTC,
  priorityLabels,
  taskSchema,
  type TaskInput,
  type Task,
  type List,
} from "@/lib/model";
export default function TaskDialog({
  task,
  lists,
  zone,
  initialDate,
  onClose,
  onSave,
}: {
  task: Task | null;
  lists: List[];
  zone: string;
  initialDate?: string;
  onClose: () => void;
  onSave: (
    data: TaskInput,
    scope: "one" | "future" | "series",
  ) => Promise<void>;
}) {
  const [d, setD] = useState<TaskInput>(
    task || {
      ...emptyTask(zone),
      scheduled_at: initialDate
        ? DateTime.fromISO(initialDate, { zone })
            .set({ hour: 9 })
            .toUTC()
            .toISO()
        : null,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(!!task);
  const [scope, setScope] = useState<"one" | "future" | "series">("one");
  function change<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setD((v) => ({ ...v, [key]: value }));
  }
  function dateValue(iso: string | null) {
    return iso
      ? DateTime.fromISO(iso).setZone(d.timezone).toFormat("yyyy-MM-dd'T'HH:mm")
      : "";
  }
  function setDate(key: "scheduled_at" | "due_at", v: string) {
    try {
      change(key, localToUTC(v, d.timezone));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const clean = taskSchema.parse(
        Object.fromEntries(
          Object.keys(emptyTask()).map((k) => [k, d[k as keyof TaskInput]]),
        ),
      );
      await onSave(clean, scope);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog">
          <Dialog.Title>
            {task ? "A little fine-tuning." : "What’s on your mind?"}
          </Dialog.Title>
          <Dialog.Description className="muted">
            {task
              ? "Update the details, then carry on."
              : "Start with one thing. The details can wait."}
          </Dialog.Description>
          <Dialog.Close
            className="icon-button close"
            aria-label="Close task editor"
          >
            <X size={20} />
          </Dialog.Close>
          <form
            onSubmit={submit}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                e.currentTarget.requestSubmit();
            }}
          >
            <label className="sr-only" htmlFor="task-title">
              Task title
            </label>
            <input
              id="task-title"
              className="title-input"
              autoFocus
              required
              maxLength={200}
              placeholder="e.g. Make time for a walk"
              value={d.title}
              onChange={(e) => change("title", e.target.value)}
            />
            <div className="form-grid">
              <label>
                <CalendarDays size={15} /> Date & time
                <input
                  type="datetime-local"
                  value={dateValue(d.scheduled_at)}
                  onChange={(e) => setDate("scheduled_at", e.target.value)}
                />
              </label>
              <label>
                Priority
                <select
                  value={d.priority}
                  onChange={(e) => change("priority", Number(e.target.value))}
                >
                  {priorityLabels.map((p, i) => (
                    <option value={i} key={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="shortcuts">
              {["Today", "Tomorrow", "This evening", "Next week"].map(
                (name, i) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() =>
                      change(
                        "scheduled_at",
                        DateTime.now()
                          .setZone(d.timezone)
                          .plus({ days: i === 1 ? 1 : i === 3 ? 7 : 0 })
                          .set({
                            hour: i === 2 ? 18 : 9,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                          })
                          .toUTC()
                          .toISO(),
                      )
                    }
                  >
                    {name}
                  </button>
                ),
              )}
            </div>
            <button
              className="text-link details-toggle"
              type="button"
              onClick={() => setAdvanced(!advanced)}
            >
              <ChevronDown size={16} />
              {advanced ? "Fewer details" : "Add details, reminders & repeat"}
            </button>
            {advanced && (
              <div className="advanced">
                <label>
                  Notes
                  <textarea
                    value={d.description}
                    maxLength={10000}
                    placeholder="A few details, a helpful link…"
                    onChange={(e) => change("description", e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    List
                    <select
                      value={d.list_id || ""}
                      onChange={(e) =>
                        change("list_id", e.target.value || null)
                      }
                    >
                      <option value="">Inbox</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due date & time
                    <input
                      type="datetime-local"
                      value={dateValue(d.due_at)}
                      onChange={(e) => setDate("due_at", e.target.value)}
                    />
                  </label>
                  <label>
                    Timezone
                    <input
                      value={d.timezone}
                      onChange={(e) => change("timezone", e.target.value)}
                      list="timezones"
                    />
                    <datalist id="timezones">
                      {Intl.supportedValuesOf("timeZone").map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Repeat
                    <select
                      value={d.recurrence?.frequency || "none"}
                      disabled={!!task?.series_id && scope === "one"}
                      onChange={(e) =>
                        change(
                          "recurrence",
                          e.target.value === "none"
                            ? null
                            : {
                                frequency: e.target.value as NonNullable<
                                  TaskInput["recurrence"]
                                >["frequency"],
                                interval: 1,
                                weekdays: [1, 3, 5],
                              },
                        )
                      }
                    >
                      {[
                        "none",
                        "daily",
                        "weekdays",
                        "weekly",
                        "monthly",
                        "yearly",
                        "custom",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {v === "none"
                            ? "Does not repeat"
                            : v.charAt(0).toUpperCase() + v.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {d.recurrence && (
                  <div className="repeat-options">
                    {["daily", "weekly", "monthly", "yearly"].includes(
                      d.recurrence.frequency,
                    ) && (
                      <label>
                        Repeat every
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={d.recurrence.interval}
                          disabled={!!task?.series_id && scope === "one"}
                          onChange={(e) =>
                            change("recurrence", {
                              ...d.recurrence!,
                              interval: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    {d.recurrence.frequency === "custom" && (
                      <fieldset>
                        <legend>On these days</legend>
                        <div className="weekday-picker">
                          {[
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                            "Sun",
                          ].map((n, i) => (
                            <label key={n}>
                              <input
                                type="checkbox"
                                checked={d.recurrence!.weekdays.includes(i + 1)}
                                disabled={!!task?.series_id && scope === "one"}
                                onChange={(e) =>
                                  change("recurrence", {
                                    ...d.recurrence!,
                                    weekdays: e.target.checked
                                      ? [...d.recurrence!.weekdays, i + 1]
                                      : d.recurrence!.weekdays.filter(
                                          (x) => x !== i + 1,
                                        ),
                                  })
                                }
                              />
                              {n}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </div>
                )}
                <fieldset>
                  <legend>
                    Reminders{" "}
                    <span className="muted">
                      · based on scheduled time, otherwise due time
                    </span>
                  </legend>
                  <div className="reminder-options">
                    {[0, 5, 10, 15, 30, 60, 1440].map((m) => (
                      <label key={m}>
                        <input
                          type="checkbox"
                          checked={d.reminder_offsets.includes(m)}
                          onChange={(e) =>
                            change(
                              "reminder_offsets",
                              e.target.checked
                                ? [...d.reminder_offsets, m]
                                : d.reminder_offsets.filter((x) => x !== m),
                            )
                          }
                        />
                        {m === 0
                          ? "At task time"
                          : m === 60
                            ? "1 hour before"
                            : m === 1440
                              ? "1 day before"
                              : `${m} min before`}
                      </label>
                    ))}
                  </div>
                  <label>
                    Custom reminder
                    <input
                      type="datetime-local"
                      value={dateValue(d.custom_reminders[0] || null)}
                      onChange={(e) => {
                        try {
                          const v = localToUTC(e.target.value, d.timezone);
                          change("custom_reminders", v ? [v] : []);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    />
                  </label>
                  <p className="hint">
                    Delivery needs notifications enabled in Settings and a
                    running server scheduler.
                  </p>
                </fieldset>
              </div>
            )}
            {task?.series_id && (
              <label>
                Apply changes to (choose future or series to change repeat
                pattern)
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as typeof scope)}
                >
                  <option value="one">Only this occurrence</option>
                  <option value="future">This and future occurrences</option>
                  <option value="series">Entire series</option>
                </select>
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-footer">
              <span className="muted">⌘ / Ctrl + Enter to save</span>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : task ? "Save changes" : "Add task"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
