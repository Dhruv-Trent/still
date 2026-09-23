"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Task } from "@/lib/model";
export default function Calendar({
  tasks,
  zone,
  weekStart,
  onAdd,
  onEdit,
}: {
  tasks: Task[];
  zone: string;
  weekStart: number;
  onAdd: (date: string) => void;
  onEdit: (t: Task) => void;
}) {
  const [anchor, setAnchor] = useState(DateTime.now().setZone(zone));
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const first = mode === "month" ? anchor.startOf("month") : anchor;
  const start =
    mode === "day"
      ? first.startOf("day")
      : first
          .startOf("day")
          .minus({ days: (first.weekday - (weekStart === 1 ? 1 : 7) + 7) % 7 });
  const count = mode === "month" ? 42 : mode === "week" ? 7 : 1;
  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <div>
          <button
            className="icon-button"
            aria-label="Previous period"
            onClick={() =>
              setAnchor(
                anchor.minus(
                  mode === "month"
                    ? { months: 1 }
                    : mode === "week"
                      ? { weeks: 1 }
                      : { days: 1 },
                ),
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <h3>{anchor.toFormat("MMMM yyyy")}</h3>
          <button
            className="icon-button"
            aria-label="Next period"
            onClick={() =>
              setAnchor(
                anchor.plus(
                  mode === "month"
                    ? { months: 1 }
                    : mode === "week"
                      ? { weeks: 1 }
                      : { days: 1 },
                ),
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div>
          <button onClick={() => setAnchor(DateTime.now().setZone(zone))}>
            Today
          </button>
          <label className="sr-only" htmlFor="calendar-mode">
            Calendar view
          </label>
          <select
            id="calendar-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            {["month", "week", "day"].map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={`calendar-grid ${mode}`}>
        {Array.from({ length: count }, (_, i) => {
          const date = start.plus({ days: i });
          const matches = tasks.filter((t) =>
            [t.scheduled_at, t.due_at].some(
              (iso) =>
                iso && DateTime.fromISO(iso).setZone(zone).hasSame(date, "day"),
            ),
          );
          return (
            <section
              className={`calendar-cell ${date.hasSame(DateTime.now().setZone(zone), "day") ? "today" : ""} ${date.month !== anchor.month ? "other-month" : ""}`}
              key={i}
            >
              <button
                className="calendar-date"
                onClick={() => onAdd(date.toISODate()!)}
                aria-label={`Add task on ${date.toISODate()}`}
              >
                <span>
                  {date.toFormat("ccc")} <b>{date.day}</b>
                </span>
                <Plus size={13} />
              </button>
              {matches.map((t) => (
                <button
                  className={`calendar-task ${t.status === "completed" ? "completed" : ""}`}
                  onClick={() => onEdit(t)}
                  key={t.id}
                >
                  {t.scheduled_at && (
                    <small>
                      {DateTime.fromISO(t.scheduled_at)
                        .setZone(zone)
                        .toFormat("HH:mm")}
                    </small>
                  )}
                  {t.title}
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
