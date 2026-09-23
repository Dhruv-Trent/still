"use client";
import Link from "next/link";
import {
  Check,
  Inbox,
  Sun,
  CalendarDays,
  CheckCircle2,
  Layers,
  Plus,
  Settings as SettingsIcon,
  MoreHorizontal,
} from "lucide-react";
import type { Task, List } from "@/lib/model";
const navigation = [
  { name: "Today", icon: Sun },
  { name: "Inbox", icon: Inbox },
  { name: "Upcoming", icon: CalendarDays },
  { name: "All tasks", icon: Layers },
  { name: "Completed", icon: CheckCircle2 },
  { name: "Calendar", icon: CalendarDays },
];
export default function Sidebar({
  mobile,
  compact,
  view,
  remaining,
  tasks,
  lists,
  displayName,
  email,
  onAdd,
  onList,
  onNavigate,
}: {
  mobile: boolean;
  compact: boolean;
  view: string;
  remaining: number;
  tasks: Task[];
  lists: List[];
  displayName?: string;
  email?: string;
  onAdd: () => void;
  onList: (list: List | "new") => void;
  onNavigate: (view: string) => void;
}) {
  return (
    <aside
      id="workspace-navigation"
      inert={compact && !mobile}
      aria-hidden={compact && !mobile}
      className={`sidebar ${mobile ? "open" : ""}`}
    >
      <Link href="/" className="brand">
        <span className="brandmark">
          <Check size={23} />
        </span>
        still<span className="brand-dot">.</span>
      </Link>
      <button className="quick-add primary" onClick={() => onAdd()}>
        <Plus size={19} />
        Add a task<kbd>N</kbd>
      </button>
      <nav aria-label="Workspace">
        {navigation.map(({ name, icon: Icon }) => (
          <button
            className={view === name ? "active" : ""}
            key={name}
            onClick={() => onNavigate(name)}
          >
            <Icon size={19} />
            <span>{name}</span>
            {name === "Today" ? (
              <span className="nav-count">{remaining}</span>
            ) : name === "Inbox" ? (
              <span className="nav-count">
                {tasks.filter((t) => !t.list_id && t.status === "open").length}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="list-heading">
        <span>MY LISTS</span>
        <button
          className="icon-button"
          aria-label="Create list"
          onClick={() => onList("new")}
        >
          <Plus size={17} />
        </button>
      </div>
      <nav aria-label="Your lists">
        {lists.map((l) => (
          <div className="list-nav-row" key={l.id}>
            <button
              className={view === l.id ? "active" : ""}
              onClick={() => onNavigate(l.id)}
            >
              <span className="list-square" />
              {l.name}
            </button>
            <button
              className="icon-button list-edit"
              aria-label={`Edit ${l.name} list`}
              onClick={() => onList(l)}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span>ONE THING AT A TIME</span>
          <p>
            A little progress
            <br />
            is still progress.
          </p>
        </div>
        <button
          className={view === "Settings" ? "active account-nav" : "account-nav"}
          onClick={() => onNavigate("Settings")}
        >
          <span className="avatar">
            {(displayName || email || "S")[0].toUpperCase()}
          </span>
          <span>
            {displayName || "Your workspace"}
            <small>Personal account</small>
          </span>
          <SettingsIcon size={18} />
        </button>
      </div>
    </aside>
  );
}
