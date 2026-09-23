import { useState } from "react";
import { DateTime } from "luxon";
import {
  emptyTask,
  type Mutation,
  type Snapshot,
  type Task,
} from "../../lib/model";
import { project } from "../../lib/offline";
const uid = "11111111-1111-4111-8111-111111111111";
const now = DateTime.now().setZone("UTC");
const titles = [
  "Finish the project proposal",
  "Pick up groceries",
  "Book a dentist appointment",
  "Make room for a walk",
];
const snapshot: Snapshot = {
  tasks: titles.map(
    (title, i) =>
      ({
        ...emptyTask("UTC"),
        id: crypto.randomUUID(),
        user_id: uid,
        version: 1,
        deleted_at: null,
        completed_at: null,
        series_id: null,
        occurrence_index: 0,
        created_at: now.toISO()!,
        updated_at: now.toISO()!,
        title,
        priority: i === 0 ? 3 : i === 1 ? 2 : 0,
        scheduled_at: now.set({ hour: 9 + i * 2, minute: 0 }).toISO(),
        position: (i + 1) * 10,
      }) as Task,
  ),
  lists: [],
  profile: {
    display_name: "Alex",
    timezone: "UTC",
    theme: "light",
    week_start: 1,
    locale: "en-US",
    version: 1,
  },
  reminders: [],
  pushCount: 0,
  schedulerHealthy: false,
};
export function useWorkspace() {
  const [data, setData] = useState(snapshot);
  return {
    data,
    queue: [],
    message: "",
    syncing: false,
    online: true,
    mutate: async (input: Omit<Mutation, "id">) => {
      setData((s) =>
        project({
          snapshot: s,
          queue: [{ ...input, id: crypto.randomUUID() }],
        }),
      );
    },
    sync: async () => {},
    resolve: async () => {},
  };
}
export async function api() {
  return { ok: true };
}
