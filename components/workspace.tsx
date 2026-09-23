"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./sidebar";
import { DateTime } from "luxon";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  Sun,
  CheckCircle2,
  Plus,
  Search,
  Menu,
  X,
  ChevronRight,
  Flag,
  Cloud,
  CloudOff,
} from "lucide-react";
import { useWorkspace } from "@/lib/use-workspace";
import {
  emptyTask,
  isOverdue,
  priorityLabels,
  type Task,
  type TaskInput,
  type List,
} from "@/lib/model";
import TaskDialog from "./task-dialog";
import TaskRow from "./task-row";
import Calendar from "./calendar";
import Settings from "./settings";

export default function Workspace({
  user,
}: {
  user: { id: string; email?: string };
}) {
  const { data, queue, message, syncing, online, mutate, sync, resolve } =
    useWorkspace(user.id);
  const [view, setView] = useState("Today");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [listFilter, setListFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState("position");
  const [editor, setEditor] = useState<{
    task: Task | null;
    date?: string;
  } | null>(null);
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = matchMedia("(max-width:800px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("keydown", close);
    };
  }, []);
  const [listEditor, setListEditor] = useState<List | "new" | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleteScope, setDeleteScope] = useState<"one" | "future" | "series">(
    "one",
  );
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const zone =
    data?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = DateTime.now().setZone(zone);
  const locale = data?.profile?.locale || navigator.language;
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setError("Offline page setup failed. Please reload while online."),
        );
  }, []);
  useEffect(() => {
    const theme = data?.profile?.theme || "system";
    document.documentElement.dataset.theme = theme;
  }, [data?.profile?.theme]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        (e.target instanceof HTMLElement &&
          (e.target.matches("input,textarea,select") ||
            e.target.isContentEditable)) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        editor ||
        listEditor
      )
        return;
      if (e.key === "n") {
        e.preventDefault();
        setEditor({ task: null });
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [editor, listEditor]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const tasks = data?.tasks || [];
  const lists = data?.lists || [];
  const onDay = (t: Task, d = now) =>
    [t.scheduled_at, t.due_at].some(
      (iso) => iso && DateTime.fromISO(iso).setZone(zone).hasSame(d, "day"),
    );
  const today = tasks.filter((t) => onDay(t));
  const done = today.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => isOverdue(t));
  const remaining = today.length - done;
  const filtered = tasks
    .filter((t) => {
      const list = lists.find((l) => l.id === t.list_id);
      const matchesSearch = `${t.title} ${t.description} ${list?.name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      if (
        !matchesSearch ||
        (priority !== "all" && t.priority !== Number(priority)) ||
        (listFilter !== "all" && (t.list_id || "inbox") !== listFilter) ||
        (status !== "all" && t.status !== status) ||
        (dateFilter && !onDay(t, DateTime.fromISO(dateFilter, { zone })))
      )
        return false;
      if (search) return true;
      if (view === "Completed") return t.status === "completed";
      if (view === "All tasks" || view === "Calendar") return true;
      if (t.status === "completed") return false;
      if (view === "Today") return onDay(t) || isOverdue(t);
      if (view === "Inbox") return !t.list_id;
      if (view === "Upcoming")
        return (
          !!(t.scheduled_at || t.due_at) &&
          DateTime.fromISO(t.scheduled_at || t.due_at!)
            .setZone(zone)
            .startOf("day") > now.startOf("day")
        );
      return t.list_id === view;
    })
    .sort((a, b) =>
      sort === "priority"
        ? b.priority - a.priority
        : sort === "date"
          ? Date.parse(a.scheduled_at || a.due_at || "9999-12-31") -
            Date.parse(b.scheduled_at || b.due_at || "9999-12-31")
          : sort === "title"
            ? a.title.localeCompare(b.title)
            : a.position - b.position,
    );
  const title = search
    ? "Search results"
    : lists.find((l) => l.id === view)?.name || view;
  const syncLabel = !online
    ? "Offline · changes saved here"
    : syncing
      ? "Syncing…"
      : message
        ? "Sync needs attention"
        : queue.length
          ? `${queue.length} pending`
          : "Synced";
  async function action(fn: () => Promise<void>, text: string) {
    try {
      setError("");
      await fn();
      setFeedback(text);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function input(t: Task): TaskInput {
    return Object.fromEntries(
      Object.keys(emptyTask()).map((k) => [k, t[k as keyof Task]]),
    ) as TaskInput;
  }
  async function saveTask(
    d: TaskInput,
    scope: "one" | "future" | "series" = "one",
    t = editor?.task,
  ) {
    await mutate({
      entity: "task",
      action: "put",
      record_id: t?.id || crypto.randomUUID(),
      expected_version: t?.version || 0,
      scope,
      data: t
        ? d
        : {
            ...d,
            position:
              tasks.reduce(
                (max, item) => Math.max(max, item.position || 0),
                0,
              ) + 10,
          },
    });
    setFeedback(t ? "Task updated" : "Task added");
  }
  async function move(t: Task, direction: number) {
    const index = filtered.findIndex((item) => item.id === t.id);
    const neighbor = filtered[index + direction];
    if (!neighbor) return;
    if (direction < 0 && neighbor.position === 0) {
      await saveTask(
        { ...input(neighbor), position: Math.max(t.position + 1, 1) },
        "one",
        neighbor,
      );
      await saveTask({ ...input(t), position: 0 }, "one", t);
    } else
      await saveTask(
        { ...input(t), position: Math.max(0, neighbor.position + direction) },
        "one",
        t,
      );
  }
  async function complete(t: Task) {
    await saveTask(
      { ...input(t), status: t.status === "completed" ? "open" : "completed" },
      "one",
      t,
    );
    setFeedback(
      t.status === "completed"
        ? "Task restored"
        : "One less thing. Nicely done.",
    );
  }
  function go(name: string) {
    if (name === "Upcoming") setSort("date");
    setView(name);
    setSearch("");
    setMobile(false);
  }
  if (!data)
    return (
      <main className="loading" aria-busy="true">
        <span className="brandmark">
          <Check />
        </span>
        <p>Making a little room…</p>
        {message && <p role="alert">{message}</p>}
      </main>
    );
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to tasks
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <Sidebar
        mobile={mobile}
        compact={compact}
        view={view}
        remaining={remaining}
        tasks={tasks}
        lists={lists}
        displayName={data.profile?.display_name}
        email={user.email}
        onAdd={() => setEditor({ task: null })}
        onList={setListEditor}
        onNavigate={go}
      />
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            My workspace <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <button
            className="sync-status"
            aria-label={syncLabel}
            onClick={() => void sync()}
            title="Synchronize now"
          >
            {online ? <Cloud size={15} /> : <CloudOff size={15} />}
            <span>{syncLabel}</span>
          </button>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {now
                  .setLocale(locale)
                  .toLocaleString({
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                  .toUpperCase()}
              </div>
              <h1>
                {view === "Today" && !search
                  ? `Good ${now.hour < 12 ? "morning" : now.hour < 18 ? "afternoon" : "evening"}${data.profile?.display_name ? `, ${data.profile.display_name.split(" ")[0]}` : ""}.`
                  : title}
              </h1>
              <p className="muted">
                {view === "Today" && !search
                  ? "A fresh perspective. A little focus. Your day, at your pace."
                  : view === "Upcoming"
                    ? "A little planning makes room for what’s next."
                    : view === "Completed"
                      ? "Take a moment to see how far you’ve come."
                      : view === "Settings"
                        ? "Small details. A better everyday."
                        : "Everything in its right place."}
              </p>
            </div>
            {view !== "Settings" && (
              <button
                className="primary desktop-add"
                onClick={() => setEditor({ task: null })}
              >
                <Plus size={18} />
                New task
              </button>
            )}
          </div>
          {(message || error) && (
            <div className="error" role="alert">
              {error || message}{" "}
              <button onClick={() => void sync()}>Try sync again</button>
            </div>
          )}
          {queue
            .filter((q) => q.error)
            .map((q) => (
              <div className="conflict" key={q.id}>
                <strong>A change needs your attention</strong>
                <p>{q.error}</p>
                <pre>{JSON.stringify(q.data, null, 2)}</pre>
                <button
                  onClick={() =>
                    void action(
                      () => resolve(q.id, true),
                      "Your change will be retried against the latest version",
                    )
                  }
                >
                  Apply my version
                </button>
                <button
                  onClick={() =>
                    void action(
                      () => resolve(q.id, false),
                      "Pending changes for this item discarded",
                    )
                  }
                >
                  Use server version
                </button>
              </div>
            ))}
          {view === "Settings" ? (
            <Settings
              user={user}
              data={data}
              pending={queue.length}
              onSave={async (p) =>
                mutate({
                  entity: "profile",
                  action: "put",
                  record_id: user.id,
                  expected_version: data.profile?.version || 0,
                  scope: "one",
                  data: p,
                })
              }
              onRefresh={sync}
            />
          ) : (
            <>
              {view === "Today" && !search && (
                <section className="day-summary" aria-label="Daily progress">
                  <div>
                    <span className="summary-icon">
                      <Sun size={23} />
                    </span>
                    <span>
                      <strong>{remaining}</strong>
                      <small>On your agenda</small>
                    </span>
                  </div>
                  <div>
                    <span className="summary-icon check">
                      <CheckCircle2 size={23} />
                    </span>
                    <span>
                      <strong>{done}</strong>
                      <small>Agenda completed</small>
                    </span>
                  </div>
                  <div>
                    <span className="summary-icon overdue">
                      <Flag size={22} />
                    </span>
                    <span>
                      <strong>{overdue.length}</strong>
                      <small>Need a little attention</small>
                    </span>
                  </div>
                  <div className="summary-progress">
                    <div>
                      <span>Your daily rhythm</span>
                      <strong>
                        {today.length
                          ? Math.round((done / today.length) * 100)
                          : 0}
                        %
                      </strong>
                    </div>
                    <div className="progress">
                      <i
                        style={{
                          width: `${today.length ? (done / today.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <small>
                      {done} of {today.length} tasks complete
                    </small>
                  </div>
                </section>
              )}
              <div className="task-toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a little clarity…"
                    aria-label="Search tasks"
                  />
                  <kbd>/</kbd>
                </div>
                <label className="sr-only" htmlFor="priority-filter">
                  Filter by priority
                </label>
                <select
                  id="priority-filter"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="all">All priorities</option>
                  {priorityLabels.map((p, i) => (
                    <option key={p} value={i}>
                      {p}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="sort-tasks">
                  Sort tasks
                </label>
                <select
                  id="sort-tasks"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="position">Custom order</option>
                  <option value="date">Date</option>
                  <option value="priority">Priority</option>
                  <option value="title">Title</option>
                </select>
                <details className="filter-menu">
                  <summary>Filters</summary>
                  <div>
                    <label>
                      Status
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        <option value="open">Open</option>
                        <option value="completed">Completed</option>
                      </select>
                    </label>
                    <label>
                      List
                      <select
                        value={listFilter}
                        onChange={(e) => setListFilter(e.target.value)}
                      >
                        <option value="all">All lists</option>
                        <option value="inbox">Inbox</option>
                        {lists.map((l) => (
                          <option value={l.id} key={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setStatus("all");
                        setListFilter("all");
                        setDateFilter("");
                        setPriority("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </details>
              </div>
              {view === "Calendar" && !search ? (
                <Calendar
                  tasks={filtered}
                  zone={zone}
                  weekStart={data.profile?.week_start ?? 1}
                  onAdd={(date) => setEditor({ task: null, date })}
                  onEdit={(task) => setEditor({ task })}
                />
              ) : (
                <section className="task-section">
                  <div className="section-title">
                    <h2>
                      {view === "Today" && !search
                        ? "Your focus for today"
                        : title}{" "}
                      <span className="pill">{filtered.length}</span>
                    </h2>
                    <span className="muted">One thing at a time.</span>
                  </div>
                  {filtered.length ? (
                    filtered.map((t, index) => {
                      const date = t.scheduled_at || t.due_at;
                      const group =
                        view === "Upcoming" && date
                          ? DateTime.fromISO(date)
                              .setZone(zone)
                              .hasSame(now.plus({ days: 1 }), "day")
                            ? "Tomorrow"
                            : DateTime.fromISO(date).setZone(zone) <
                                now.plus({ days: 7 })
                              ? "This week"
                              : "Later"
                          : "";
                      const prev = filtered[index - 1];
                      const prevDate = prev?.scheduled_at || prev?.due_at;
                      const prevGroup = prevDate
                        ? DateTime.fromISO(prevDate)
                            .setZone(zone)
                            .hasSame(now.plus({ days: 1 }), "day")
                          ? "Tomorrow"
                          : DateTime.fromISO(prevDate).setZone(zone) <
                              now.plus({ days: 7 })
                            ? "This week"
                            : "Later"
                        : "";
                      return (
                        <div key={t.id}>
                          {group && group !== prevGroup && (
                            <h3 className="group-title">{group}</h3>
                          )}
                          <TaskRow
                            task={t}
                            listName={
                              lists.find((l) => l.id === t.list_id)?.name ||
                              "Inbox"
                            }
                            zone={zone}
                            locale={locale}
                            onComplete={() =>
                              void action(() => complete(t), "Task updated")
                            }
                            onEdit={() => setEditor({ task: t })}
                            onDuplicate={() =>
                              void action(
                                () =>
                                  saveTask(
                                    {
                                      ...input(t),
                                      title: `${t.title.slice(0, 190)} (copy)`,
                                      status: "open",
                                    },
                                    "one",
                                    null,
                                  ),
                                "Task duplicated",
                              )
                            }
                            onReschedule={(days) =>
                              void action(
                                () =>
                                  saveTask(
                                    {
                                      ...input(t),
                                      scheduled_at: now
                                        .plus({ days })
                                        .set({
                                          hour: 9,
                                          minute: 0,
                                          second: 0,
                                          millisecond: 0,
                                        })
                                        .toUTC()
                                        .toISO(),
                                      due_at: t.due_at
                                        ? now
                                            .plus({ days })
                                            .endOf("day")
                                            .toUTC()
                                            .toISO()
                                        : null,
                                    },
                                    "one",
                                    t,
                                  ),
                                "Task rescheduled",
                              )
                            }
                            onMove={(direction) =>
                              void action(
                                () => move(t, direction),
                                "Order updated",
                              )
                            }
                            onDelete={() => {
                              setDeleteTask(t);
                              setDeleteScope("one");
                            }}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">
                      <div className="empty-art">
                        <Check size={30} />
                      </div>
                      <h3>
                        {search
                          ? "No tasks match your search."
                          : view === "Today"
                            ? "You’re all caught up."
                            : view === "Completed"
                              ? "A little progress belongs here."
                              : view === "Upcoming"
                                ? "Nothing scheduled yet."
                                : "A little space for a new idea."}
                      </h3>
                      <p>
                        {search
                          ? "Try a different word or clear your filters."
                          : view === "Completed"
                            ? "Completed tasks will appear here."
                            : "Let’s make room for the next thing that matters."}
                      </p>
                      {view !== "Completed" && (
                        <button
                          className="text-link"
                          onClick={() => setEditor({ task: null })}
                        >
                          <Plus size={17} />
                          Add a task
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    className="inline-add"
                    onClick={() => setEditor({ task: null })}
                  >
                    <Plus size={18} />
                    Add a task <span>Press N</span>
                  </button>
                </section>
              )}
              <div className="workspace-footnote">
                There’s no rush. Just a little forward.
              </div>
            </>
          )}
        </main>
      </div>
      <button
        className="mobile-fab primary"
        aria-label="Add a task"
        onClick={() => setEditor({ task: null })}
      >
        <Plus size={24} />
      </button>
      {feedback && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {feedback}
        </div>
      )}
      {editor && (
        <TaskDialog
          key={editor.task?.id || "new"}
          task={editor.task}
          lists={lists}
          zone={zone}
          initialDate={editor.date}
          onClose={() => setEditor(null)}
          onSave={saveTask}
        />
      )}
      <Dialog.Root
        open={!!listEditor}
        onOpenChange={(v) => {
          if (!v) setListEditor(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog small-dialog">
            <Dialog.Title>
              {listEditor === "new"
                ? "A place for related things."
                : "Your list"}
            </Dialog.Title>
            <Dialog.Description className="muted">
              Keep a part of your life together.
            </Dialog.Description>
            <Dialog.Close
              className="icon-button close"
              aria-label="Close list editor"
            >
              <X size={18} />
            </Dialog.Close>
            <form
              key={typeof listEditor === "object" ? listEditor?.id : "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const existing =
                  typeof listEditor === "object" ? listEditor : null;
                void action(async () => {
                  await mutate({
                    entity: "list",
                    action: "put",
                    record_id: existing?.id || crypto.randomUUID(),
                    expected_version: existing?.version || 0,
                    scope: "one",
                    data: {
                      name: String(f.get("name")),
                      position: Number(f.get("position")),
                    },
                  });
                  setListEditor(null);
                }, "List saved");
              }}
            >
              <label>
                List name
                <input
                  name="name"
                  autoFocus
                  required
                  maxLength={80}
                  defaultValue={
                    typeof listEditor === "object" ? listEditor?.name : ""
                  }
                  placeholder="e.g. Personal"
                />
              </label>
              <label>
                Order
                <input
                  type="number"
                  name="position"
                  min={0}
                  max={2147483647}
                  required
                  defaultValue={
                    typeof listEditor === "object"
                      ? listEditor?.position
                      : lists.length
                  }
                />
              </label>
              <button className="primary">Save list</button>
            </form>
            {listEditor && listEditor !== "new" && (
              <button
                className="danger delete-list"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this list? Its tasks will move to Inbox.",
                    )
                  )
                    void action(async () => {
                      await mutate({
                        entity: "list",
                        action: "delete",
                        record_id: listEditor.id,
                        expected_version: listEditor.version,
                        scope: "one",
                        data: null,
                      });
                      setListEditor(null);
                      setView("Inbox");
                    }, "List removed; tasks moved to Inbox");
                }}
              >
                Delete list
              </button>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!deleteTask}
        onOpenChange={(v) => {
          if (!v) setDeleteTask(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog small-dialog">
            <Dialog.Title>Let this one go?</Dialog.Title>
            <Dialog.Description>
              Delete “{deleteTask?.title}”? This cannot be undone.
            </Dialog.Description>
            {deleteTask?.series_id && (
              <label>
                Delete
                <select
                  value={deleteScope}
                  onChange={(e) =>
                    setDeleteScope(e.target.value as typeof deleteScope)
                  }
                >
                  <option value="one">This occurrence</option>
                  <option value="future">This and future occurrences</option>
                  <option value="series">Entire series</option>
                </select>
              </label>
            )}
            <div className="dialog-footer">
              <Dialog.Close>Keep task</Dialog.Close>
              <button
                className="danger"
                onClick={() => {
                  if (deleteTask)
                    void action(async () => {
                      await mutate({
                        entity: "task",
                        action: "delete",
                        record_id: deleteTask.id,
                        expected_version: deleteTask.version,
                        scope: deleteScope,
                        data: null,
                      });
                      setDeleteTask(null);
                    }, "Task deleted");
                }}
              >
                Delete task
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
