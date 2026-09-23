import { openDB } from "idb";
import type { Mutation, Snapshot } from "./model";
export type Pending = Mutation & { error?: string };
export type LocalState = { snapshot: Snapshot; queue: Pending[] };
const blank: Snapshot = {
  tasks: [],
  lists: [],
  profile: null,
  reminders: [],
  pushCount: 0,
  schedulerHealthy: false,
};
export async function database() {
  return openDB("still-v1", 1, {
    upgrade(db) {
      db.createObjectStore("accounts");
    },
  });
}
export async function readLocal(uid: string): Promise<LocalState> {
  return (
    (await (await database()).get("accounts", uid)) || {
      snapshot: blank,
      queue: [],
    }
  );
}
export async function updateLocal(
  uid: string,
  fn: (s: LocalState) => LocalState,
) {
  const db = await database();
  const tx = db.transaction("accounts", "readwrite");
  const current: LocalState = (await tx.store.get(uid)) || {
    snapshot: blank,
    queue: [],
  };
  const next = fn(current);
  await tx.store.put(next, uid);
  await tx.done;
  return next;
}
export async function clearLocal(uid: string) {
  await (await database()).delete("accounts", uid);
}
export function project(state: LocalState): Snapshot {
  const s = structuredClone(state.snapshot);
  for (const m of state.queue) {
    if (m.entity === "profile") {
      s.profile = {
        ...s.profile,
        ...(m.data as object),
        version: m.expected_version + 1,
      } as Snapshot["profile"];
      continue;
    }
    const key = m.entity === "task" ? "tasks" : "lists";
    const items = s[key] as unknown as { id: string; version: number }[];
    const index = items.findIndex((x) => x.id === m.record_id);
    if (m.action === "delete") {
      if (index >= 0) items.splice(index, 1);
      continue;
    }
    const item = {
      ...(index >= 0 ? items[index] : {}),
      ...(m.data as object),
      id: m.record_id,
      version: m.expected_version + 1,
    };
    if (index >= 0) items[index] = item;
    else items.push(item);
  }
  return s;
}
