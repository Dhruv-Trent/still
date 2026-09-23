import { NextResponse } from "next/server";
import {
  admin,
  authenticate,
  failure,
  HttpError,
  readJSON,
} from "@/lib/server";
import { mutationSchema } from "@/lib/model";
import type { SupabaseClient } from "@supabase/supabase-js";
async function allTasks(db: SupabaseClient) {
  const items = [];
  for (let start = 0; start < 10000; start += 1000) {
    const result = await db
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .order("id")
      .range(start, start + 999);
    if (result.error) return { data: null, error: result.error };
    items.push(...result.data);
    if (result.data.length < 1000) return { data: items, error: null };
  }
  throw new HttpError(
    409,
    "Workspace exceeds this release’s 10,000-task sync limit",
  );
}

export async function GET(req: Request) {
  try {
    const { db } = await authenticate(req);
    const [tasks, lists, profile, reminders, push, health] = await Promise.all([
      allTasks(db),
      db
        .from("task_lists")
        .select("*")
        .is("deleted_at", null)
        .order("position")
        .limit(1000),
      db.from("profiles").select("*").maybeSingle(),
      db
        .from("reminders")
        .select("id,task_id,status,reminder_at")
        .order("reminder_at", { ascending: false })
        .limit(10000),
      db
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true }),
      admin()
        .from("scheduler_health")
        .select("last_run")
        .eq("id", true)
        .maybeSingle(),
    ]);
    if ([tasks, lists, profile, reminders, push, health].some((r) => r.error))
      throw new HttpError(503, "Unable to load your workspace");
    if (tasks.data!.length === 10000 || lists.data!.length === 1000)
      throw new HttpError(
        409,
        "Workspace exceeds this release’s sync limit. Export or archive data before continuing.",
      );
    return NextResponse.json({
      tasks: tasks.data,
      lists: lists.data,
      profile: profile.data,
      reminders: reminders.data,
      pushCount: push.count || 0,
      schedulerHealthy:
        !!health.data && Date.now() - Date.parse(health.data.last_run) < 180000,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { db } = await authenticate(req);
    const parsed = mutationSchema.safeParse(await readJSON(req));
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0].message);
    const { data, error } = await db.rpc("apply_mutation", { m: parsed.data });
    if (error) {
      if (error.code === "40001")
        throw new HttpError(
          409,
          "This item changed on another device. Review your pending change.",
        );
      if (error.code === "42501")
        throw new HttpError(403, "You do not have access to this item");
      if (error.code === "P0003")
        throw new HttpError(429, "Too many changes. Please wait a minute.");
      throw new HttpError(
        400,
        "The change could not be saved. Check the fields and try again.",
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}
