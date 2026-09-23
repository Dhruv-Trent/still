"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { project, readLocal, updateLocal, type LocalState } from "./offline";
import type { Mutation, Snapshot } from "./model";
export async function api(path: string, init: RequestInit = {}) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw Error("Please sign in again");
  const r = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...init.headers,
    },
  });
  const body = await r.json();
  if (!r.ok) {
    const e = new Error(body.error || "Request failed") as Error & {
      status: number;
    };
    e.status = r.status;
    throw e;
  }
  return body;
}
export function useWorkspace(uid: string) {
  const [state, setState] = useState<LocalState | null>(null);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const busy = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(
    async () => setState(await readLocal(uid)),
    [uid],
  );
  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    setSyncing(true);
    try {
      const run = async () => {
        let local = await readLocal(uid);
        for (const mutation of local.queue) {
          if (mutation.error) break;
          try {
            const { error: _, ...payload } = mutation;
            void _;
            await api("/api/sync", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            local = await updateLocal(uid, (s) => ({
              snapshot: project({ snapshot: s.snapshot, queue: [mutation] }),
              queue: s.queue.filter((m) => m.id !== mutation.id),
            }));
          } catch (e) {
            if (
              (e as { status?: number }).status &&
              (e as { status: number }).status < 500 &&
              (e as { status: number }).status !== 429
            ) {
              await updateLocal(uid, (s) => ({
                ...s,
                queue: s.queue.map((m) =>
                  m.id === mutation.id
                    ? { ...m, error: (e as Error).message }
                    : m,
                ),
              }));
            }
            throw e;
          }
        }
        const snapshot: Snapshot = await api("/api/sync");
        await updateLocal(uid, (s) => ({ ...s, snapshot }));
        setMessage("");
      };
      if (navigator.locks)
        await navigator.locks.request(`still-sync-${uid}`, run);
      else await run();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      try {
        await refresh();
        channel.current?.postMessage("refresh");
      } catch {
        setMessage(
          "Device storage is unavailable. Enable browser storage, then reload before editing.",
        );
      }
      busy.current = false;
      setSyncing(false);
    }
  }, [uid, refresh]);
  useEffect(() => {
    channel.current = new BroadcastChannel(`still-${uid}`);
    channel.current.onmessage = () => void refresh();
    void refresh()
      .then(sync)
      .catch(() =>
        setMessage(
          "Device storage is unavailable. Enable browser storage, then reload.",
        ),
      );
    const connectivity = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    connectivity();
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    const timer = setInterval(() => void sync(), 30000);
    const live = supabase()
      .channel(`workspace-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${uid}`,
        },
        () => void sync(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_lists",
          filter: `user_id=eq.${uid}`,
        },
        () => void sync(),
      )
      .subscribe();
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      channel.current?.close();
      channel.current = null;
      void supabase().removeChannel(live);
    };
  }, [uid, refresh, sync]);
  async function mutate(input: Omit<Mutation, "id">) {
    await updateLocal(uid, (s) => ({
      ...s,
      queue: [...s.queue, { ...input, id: crypto.randomUUID() }],
    }));
    await refresh();
    channel.current?.postMessage("refresh");
    void sync();
  }
  async function resolve(id: string, keep: boolean) {
    const fresh: Snapshot = await api("/api/sync");
    await updateLocal(uid, (s) => {
      const m = s.queue.find((q) => q.id === id);
      if (!m) return s;
      const record =
        m.entity === "task"
          ? fresh.tasks.find((t) => t.id === m.record_id)
          : m.entity === "list"
            ? fresh.lists.find((l) => l.id === m.record_id)
            : fresh.profile;
      if (keep && !record && m.expected_version > 0)
        throw Error("This item was deleted. Copy your change into a new task.");
      return {
        snapshot: fresh,
        queue: keep
          ? s.queue.map((q) =>
              q.id === id
                ? {
                    ...q,
                    id: crypto.randomUUID(),
                    error: undefined,
                    expected_version: record?.version || 0,
                  }
                : q,
            )
          : s.queue.filter((q) => q.id !== id && q.record_id !== m.record_id),
      };
    });
    await refresh();
    void sync();
  }
  return {
    data: state ? project(state) : null,
    queue: state?.queue || [],
    message,
    syncing,
    online,
    mutate,
    sync,
    resolve,
  };
}
