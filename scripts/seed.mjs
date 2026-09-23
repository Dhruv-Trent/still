// Opt-in seeding through the real authenticated mutation boundary. Never runs automatically.
import { createClient } from "@supabase/supabase-js";
if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEV_SEED !== "true"
)
  throw Error(
    "Set ALLOW_DEV_SEED=true only for a disposable development project",
  );
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const { error } = await db.auth.signInWithPassword({
  email: process.env.SEED_EMAIL,
  password: process.env.SEED_PASSWORD,
});
if (error) throw Error("Development account sign-in failed");
for (const [index, title] of [
  "Finish project report",
  "Grocery shopping",
  "Call dentist",
  "Gym workout",
  "Pay electricity bill",
].entries()) {
  const { error } = await db.rpc("apply_mutation", {
    m: {
      id: crypto.randomUUID(),
      entity: "task",
      action: "put",
      record_id: crypto.randomUUID(),
      expected_version: 0,
      scope: "one",
      data: {
        title,
        description: "Development seed task",
        priority: 0,
        list_id: null,
        scheduled_at: null,
        due_at: null,
        timezone: "UTC",
        reminder_offsets: [],
        custom_reminders: [],
        status: "open",
        position: (index + 1) * 10,
        recurrence: null,
      },
    },
  });
  if (error) throw Error("Development seed failed");
}
await db.auth.signOut();
console.log("Added five development tasks.");
