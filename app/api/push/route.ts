import { NextResponse } from "next/server";
import {
  admin,
  authenticate,
  failure,
  HttpError,
  readJSON,
} from "@/lib/server";
import { pushSchema } from "@/lib/push-validation";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    const { user } = await authenticate(req);
    const input = pushSchema.safeParse(await readJSON(req));
    if (!input.success) throw new HttpError(400, "Invalid push subscription");
    const db = admin();
    const { data: existing, error: lookupError } = await db
      .from("push_subscriptions")
      .select("user_id")
      .eq("endpoint", input.data.endpoint)
      .maybeSingle();
    if (lookupError)
      throw new HttpError(503, "Unable to save notification settings");
    if (existing && existing.user_id !== user.id)
      throw new HttpError(
        409,
        "This browser subscription belongs to another account. Disable notifications before changing accounts.",
      );
    if (!existing) {
      const count = await db
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (count.error) throw new HttpError(503, "Unable to check device limit");
      if ((count.count || 0) >= 10)
        throw new HttpError(
          409,
          "You have reached the 10-device notification limit. Disable notifications on an old device first.",
        );
    }
    const record = {
      user_id: user.id,
      endpoint: input.data.endpoint,
      p256dh: input.data.keys.p256dh,
      auth: input.data.keys.auth,
    };
    const { error } = existing
      ? await db
          .from("push_subscriptions")
          .update(record)
          .eq("endpoint", record.endpoint)
          .eq("user_id", user.id)
      : await db.from("push_subscriptions").insert(record);
    if (error) throw new HttpError(503, "Unable to save notification settings");
    await db
      .from("reminders")
      .update({ status: "pending", attempts: 0 })
      .eq("user_id", user.id)
      .eq("status", "no_subscription")
      .gt("reminder_at", new Date(Date.now() - 3600000).toISOString());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const { user } = await authenticate(req);
    const input = z
      .object({ endpoint: z.string().url().max(2048) })
      .strict()
      .safeParse(await readJSON(req));
    if (!input.success) throw new HttpError(400, "Invalid subscription");
    const { error } = await admin()
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", input.data.endpoint);
    if (error) throw new HttpError(503, "Unable to disable notifications");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
