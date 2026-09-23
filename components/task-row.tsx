"use client";
import { DateTime } from "luxon";
import {
  Check,
  Flag,
  Repeat2,
  Bell,
  MoreHorizontal,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import { isOverdue, priorityLabels, type Task } from "@/lib/model";
type Props = {
  task: Task;
  listName: string;
  zone: string;
  locale: string;
  onComplete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onReschedule: (days: number) => void;
  onMove: (direction: number) => void;
  onDelete: () => void;
};
export default function TaskRow({
  task: t,
  listName,
  zone,
  locale,
  onComplete,
  onEdit,
  onDuplicate,
  onReschedule,
  onMove,
  onDelete,
}: Props) {
  const date = t.scheduled_at || t.due_at;
  return (
    <article
      className={`task-row ${t.status === "completed" ? "completed" : ""}`}
    >
      <button
        className={`task-check priority-${t.priority}`}
        aria-label={`${t.status === "completed" ? "Restore" : "Complete"} ${t.title}`}
        onClick={onComplete}
      >
        {t.status === "completed" && <Check size={15} />}
      </button>
      <button className="task-text" onClick={onEdit}>
        <strong>{t.title}</strong>
        <span>
          {listName}
          {date && (
            <>
              <i>·</i>
              <span className={isOverdue(t) ? "overdue-text" : ""}>
                {isOverdue(t) ? "Overdue · " : ""}
                {DateTime.fromISO(date)
                  .setZone(zone)
                  .setLocale(locale)
                  .toLocaleString({
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
              </span>
            </>
          )}
          {t.recurrence && <Repeat2 size={13} />}{" "}
          {(t.reminder_offsets?.length > 0 ||
            t.custom_reminders?.length > 0) && <Bell size={13} />}
        </span>
      </button>
      {t.priority > 0 && (
        <span className={`priority-label p${t.priority}`}>
          <Flag size={12} />
          {priorityLabels[t.priority]}
        </span>
      )}
      <details className="task-actions">
        <summary aria-label={`Actions for ${t.title}`}>
          <MoreHorizontal size={20} />
        </summary>
        <div>
          <button onClick={onEdit}>Edit task</button>
          <button onClick={onDuplicate}>
            <Copy size={14} />
            Duplicate
          </button>
          {["Today", "Tomorrow"].map((label, i) => (
            <button key={label} onClick={() => onReschedule(i)}>
              {label}
            </button>
          ))}
          <button onClick={() => onMove(-1)}>
            <ArrowUp size={14} />
            Move up
          </button>
          <button onClick={() => onMove(1)}>
            <ArrowDown size={14} />
            Move down
          </button>
          <button className="danger" onClick={onDelete}>
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </details>
    </article>
  );
}
