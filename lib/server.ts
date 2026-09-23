import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new HttpError(503, "Server configuration is incomplete");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function authenticate(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Please sign in again");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new HttpError(503, "Authentication is not configured");
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Please sign in again");
  const { data: allowed, error: limitError } = await admin().rpc(
    "take_rate_limit",
    { p_key: `api:${data.user.id}`, p_limit: 240, p_window: 60 },
  );
  if (limitError) throw new HttpError(503, "Service temporarily unavailable");
  if (!allowed)
    throw new HttpError(429, "Too many requests. Please wait a minute.");
  return { db, user: data.user };
}
export async function readJSON(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export function failure(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  return NextResponse.json(
    {
      error:
        e instanceof HttpError
          ? e.message
          : "Something went wrong. Please try again.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
