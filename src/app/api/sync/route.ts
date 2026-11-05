import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { syncUser } from "@/lib/sync";
import { dueForSync } from "@/lib/schedule";
import { markSeen, notifyStudent } from "@/lib/notify";

export const maxDuration = 120;

// POST: the refresh button and auto-refresh in the app. Syncs the signed-in student.
export async function POST() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const result = await syncUser(email);
    await markSeen(email); // they're looking at it, no need to ping their phone
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Time for one call; the GitHub Actions job (.github/workflows/sync.yml) calls again while students are left.
const BUDGET_MS = 90_000;

// GET: background sync. Called by GitHub Actions every ~15 minutes and by the daily Vercel cron,
// both with "Authorization: Bearer <CRON_SECRET>". Syncs whoever is due (see lib/schedule.ts),
// then sends phone notifications for urgent mail and deadlines due within a day.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  let { data: users, error } = await db.from("users").select("email, last_synced_at, last_seen_at");
  if (error) {
    // Database not updated yet (no last_seen_at): treat everyone as daily.
    const r = await db.from("users").select("email, last_synced_at");
    users = (r.data ?? []).map((u) => ({ ...u, last_seen_at: null }));
    error = r.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const queue = dueForSync(users ?? [], started);
  const results: { email: string; fetched?: number; notified?: number; error?: string }[] = [];
  for (const u of queue) {
    if (Date.now() - started > BUDGET_MS) break;
    try {
      const r = await syncUser(u.email);
      results.push({ email: mask(u.email), fetched: r.fetched, notified: await notifyStudent(u.email) });
    } catch (e) {
      // e.g. the student removed DELT's access in Google: move on, they'll sync again when they sign in
      await db.from("users").update({ last_synced_at: new Date().toISOString() }).eq("email", u.email);
      results.push({ email: mask(u.email), error: (e as Error).message.slice(0, 120) });
    }
  }
  // Deadline reminders for students who weren't due for a sync this round.
  const synced = new Set(queue.slice(0, results.length).map((u) => u.email));
  let reminders = 0;
  const { data: subscribed } = await db.from("push_subscriptions").select("user_email");
  for (const email of new Set((subscribed ?? []).map((s) => s.user_email as string))) {
    if (synced.has(email) || Date.now() - started > BUDGET_MS + 20_000) continue;
    reminders += await notifyStudent(email);
  }
  return NextResponse.json({ synced: results.length, remaining: Math.max(0, queue.length - results.length), reminders, results });
}

// Logs shouldn't carry full addresses.
const mask = (e: string) => e.replace(/^(.{3}).*(@.*)$/, "$1…$2");
