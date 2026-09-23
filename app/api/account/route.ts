import { NextResponse } from "next/server";
import {
  admin,
  authenticate,
  failure,
  HttpError,
  readJSON,
} from "@/lib/server";
import { z } from "zod";
export async function DELETE(req: Request) {
  try {
    const { user } = await authenticate(req);
    const limit = await admin().rpc("take_rate_limit", {
      p_key: `account:${user.id}`,
      p_limit: 5,
      p_window: 3600,
    });
    if (limit.error || !limit.data)
      throw new HttpError(
        429,
        "Please wait before another account deletion attempt",
      );
    const body = z
      .object({
        confirmation: z.literal("DELETE"),
        password: z.string().min(1).max(1024),
      })
      .strict()
      .safeParse(await readJSON(req));
    if (!body.success)
      throw new HttpError(400, "Confirm deletion and enter your password");
    const db = admin();
    const { error: authError } = await db.auth.signInWithPassword({
      email: user.email!,
      password: body.data.password,
    });
    if (authError) throw new HttpError(403, "Password verification failed");
    const { error } = await admin().auth.admin.deleteUser(user.id);
    if (error)
      throw new HttpError(503, "Account deletion failed. Please try again.");
    await admin()
      .from("rate_limits")
      .delete()
      .in("key", [
        `api:${user.id}`,
        `mutation:${user.id}`,
        `account:${user.id}`,
      ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
