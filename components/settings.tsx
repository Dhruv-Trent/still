"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, LogOut, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/use-workspace";
import { clearLocal } from "@/lib/offline";
import type { Profile, Snapshot } from "@/lib/model";
export default function Settings({
  user,
  data,
  pending,
  onSave,
  onRefresh,
}: {
  user: { id: string; email?: string };
  data: Snapshot;
  pending: number;
  onSave: (p: Omit<Profile, "version">) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [p, setP] = useState<Omit<Profile, "version">>({
    display_name: data.profile?.display_name || "",
    timezone:
      data.profile?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: data.profile?.theme || "system",
    week_start: data.profile?.week_start ?? 1,
    locale: data.profile?.locale || navigator.language,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enable() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      throw Error(
        "Web Push is unavailable. On iPhone or iPad, install Still to your Home Screen and open it there.",
      );
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      throw Error("The server’s push key is not configured yet.");
    if (Notification.permission === "denied")
      throw Error(
        "Notifications are blocked. Enable them in your browser or device settings.",
      );
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error("Notifications are not enabled. Your tasks are still saved.");
    const registration = await navigator.serviceWorker.ready;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      }));
    const json = subscription.toJSON();
    await api("/api/push", {
      method: "POST",
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    await onRefresh();
    setMessage(
      "This device is registered. See scheduler status below before relying on reminders.",
    );
  }
  async function disable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window))
      throw Error("Notifications are not supported in this browser.");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api("/api/push", {
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    await onRefresh();
    setMessage("Notifications disabled on this device.");
  }
  async function signOut() {
    if (pending)
      throw Error("Resolve or sync your pending changes before signing out.");
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    }
    await clearLocal(user.id);
    await supabase().auth.signOut();
    router.push("/auth");
  }
  return (
    <div className="settings">
      <section>
        <h2>A space that feels like you.</h2>
        <p className="muted">The small details that make Still yours.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await onSave(p);
              setMessage(
                "Preferences saved on this device and queued for sync.",
              );
            });
          }}
        >
          <label>
            Display name
            <input
              value={p.display_name}
              maxLength={80}
              onChange={(e) => setP({ ...p, display_name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Appearance
              <select
                value={p.theme}
                onChange={(e) =>
                  setP({ ...p, theme: e.target.value as Profile["theme"] })
                }
              >
                <option value="system">Follow system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              Start of week
              <select
                value={p.week_start}
                onChange={(e) =>
                  setP({ ...p, week_start: Number(e.target.value) })
                }
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </label>
            <label>
              Timezone
              <select
                value={p.timezone}
                onChange={(e) => setP({ ...p, timezone: e.target.value })}
              >
                {["UTC", ...Intl.supportedValuesOf("timeZone")].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <label>
              Locale
              <input
                value={p.locale}
                onChange={(e) => setP({ ...p, locale: e.target.value })}
                placeholder="en-GB"
              />
            </label>
          </div>
          <button className="primary" disabled={busy}>
            <Check size={16} />
            Save preferences
          </button>
        </form>
      </section>
      <section>
        <h2>
          <Bell size={21} /> A timely nudge.
        </h2>
        <p>
          Enable notifications to receive your scheduled reminders even when
          Still is closed. Notifications use a private, generic message on your
          lock screen.
        </p>
        <div className="notification-status">
          <span>Registered devices</span>
          <strong>{data.pushCount}</strong>
          <span>Scheduler</span>
          <strong>
            {data.schedulerHealthy
              ? "Recently checked in"
              : "Not verified — reminders may not arrive"}
          </strong>
          <span>This browser permission</span>
          <strong>
            {typeof Notification === "undefined"
              ? "Unsupported"
              : Notification.permission}
          </strong>
        </div>
        <div className="button-row">
          <button disabled={busy} onClick={() => void run(enable)}>
            Enable on this device
          </button>
          <button disabled={busy} onClick={() => void run(disable)}>
            Disable on this device
          </button>
        </div>
        <p className="hint">
          On iOS/iPadOS 16.4 or later, add Still to your Home Screen first.
          Delivery depends on connectivity and device/browser restrictions.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p className="muted">{user.email}</p>
        <div className="button-row">
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { error } = await supabase().auth.resetPasswordForEmail(
                  user.email!,
                  { redirectTo: `${location.origin}/auth/callback?next=reset` },
                );
                if (error) throw error;
                setMessage(
                  "Password reset email requested. Open it in this browser.",
                );
              })
            }
          >
            Change password
          </button>
          <button disabled={busy} onClick={() => void run(signOut)}>
            <LogOut size={16} />
            Sign out
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => setDeleting(!deleting)}
          >
            <Trash2 size={16} />
            Delete account
          </button>
        </div>
        {deleting && (
          <form
            className="delete-account"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await api("/api/account", {
                  method: "DELETE",
                  body: JSON.stringify({
                    confirmation: f.get("confirmation"),
                    password: f.get("password"),
                  }),
                });
                await clearLocal(user.id);
                await supabase().auth.signOut({ scope: "local" });
                router.push("/");
              });
            }}
          >
            <p>
              This permanently deletes your account, tasks, lists, reminders,
              and notification subscriptions. This cannot be undone.
            </p>
            <label>
              Type DELETE
              <input
                name="confirmation"
                required
                pattern="DELETE"
                autoComplete="off"
              />
            </label>
            <label>
              Current password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="danger" disabled={busy}>
              Permanently delete my account
            </button>
          </form>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section>
        <h2>Make it feel at home.</h2>
        <p>
          Install Still from your browser’s install menu. On iPhone or iPad:
          Share → Add to Home Screen. Offline changes stay on this device until
          they synchronize.
        </p>
        <p className="hint">
          Keyboard shortcuts: N to add · / to search · Escape to close · ⌘/Ctrl
          + Enter to save.
        </p>
      </section>
    </div>
  );
}
