import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { admin, failure, HttpError } from "@/lib/server";
import { pushSchema } from "@/lib/push-validation";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    const token =
      req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (
      !expected ||
      Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    )
      throw new HttpError(401, "Unauthorized");
    const db = admin();
    const expansion = await db.rpc("expand_recurrences");
    if (expansion.error)
      throw new HttpError(503, "Recurrence scheduler unavailable");
    if (
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY ||
      !process.env.VAPID_SUBJECT
    )
      return NextResponse.json({
        recurrenceSeries: expansion.data,
        pushConfigured: false,
      });
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    const { data: jobs, error } = await db.rpc("claim_reminders");
    if (error) throw new HttpError(503, "Scheduler unavailable");
    let sent = 0;
    const deadline = Date.now() + 45000;
    for (const job of jobs || []) {
      if (Date.now() > deadline) {
        await db
          .from("reminders")
          .update({
            status: "pending",
            attempts: job.attempts - 1,
            lease_until: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "sending");
        continue;
      }
      const [
        { data: task, error: taskError },
        { data: subs, error: subError },
        { data: current },
      ] = await Promise.all([
        db
          .from("tasks")
          .select("status,deleted_at")
          .eq("id", job.task_id)
          .eq("user_id", job.user_id)
          .maybeSingle(),
        db.from("push_subscriptions").select("*").eq("user_id", job.user_id),
        db.from("reminders").select("status").eq("id", job.id).maybeSingle(),
      ]);
      if (taskError || subError) continue;
      if (
        !task ||
        task.deleted_at ||
        task.status !== "open" ||
        current?.status !== "sending"
      ) {
        await db
          .from("reminders")
          .update({ status: "cancelled" })
          .eq("id", job.id)
          .eq("status", "sending");
        continue;
      }
      if (!subs?.length) {
        await db
          .from("reminders")
          .update({ status: "no_subscription" })
          .eq("id", job.id)
          .eq("status", "sending");
        continue;
      }
      let delivered = false,
        transient = false;
      await Promise.all(
        subs.map(async (sub) => {
          try {
            const subscription = pushSchema.parse({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            });
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title: "A little reminder",
                body: "A task in Still needs your attention.",
                tag: job.id,
                url: "/workspace",
              }),
              { TTL: 3600, timeout: 5000 },
            );
            delivered = true;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) {
              await db.from("push_subscriptions").delete().eq("id", sub.id);
            } else transient = true;
          }
        }),
      );
      const status = transient
        ? job.attempts >= 5
          ? "failed"
          : "pending"
        : delivered
          ? "sent"
          : "no_subscription";
      await db
        .from("reminders")
        .update({
          status,
          sent_at: delivered ? new Date().toISOString() : null,
          lease_until: new Date(
            Date.now() + Math.min(3600, 2 ** job.attempts * 30) * 1000,
          ).toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "sending");
      if (delivered) sent++;
    }
    return NextResponse.json({ processed: jobs?.length || 0, sent });
  } catch (e) {
    return failure(e);
  }
}
