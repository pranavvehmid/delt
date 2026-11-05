import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { claimSync, finishSync, syncUser } from "@/lib/sync";
import { AccessRevoked } from "@/lib/gmail";
import { limited } from "@/lib/rate-limit";
import { dueForSync } from "@/lib/schedule";
import { markSeen, notifyStudent } from "@/lib/notify";

export const maxDuration = 120;

// POST: the refresh button and auto-refresh in the app. Syncs the signed-in student.
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // #21: the app first runs a quick sync and shows the new mail, then starts ?phase=later
  // (AI re-checks, Gmail labels) without waiting for it.
  if (req.nextUrl.searchParams.get("phase") === "later") {
    const tooMany = limited(email, "ai");
    if (tooMany) return tooMany;
    try {
      const r = await syncUser(email, "later");
      return NextResponse.json({ resorted: r.rechecked, labeled: r.labeled });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: e instanceof AccessRevoked ? 409 : 500 });
    }
  }
  // At most one sync per student every 10 s, and never two at once (#30): extra taps and tabs
  // get a quick answer instead of another round of Gmail and AI calls.
  if (!(await claimSync(email, 10))) {
    return NextResponse.json({ busy: true, fetched: 0, backlog: 0, retryAfter: 10 }, { status: 429, headers: { "Retry-After": "10" } });
  }
  try {
    const result = await syncUser(email, "quick");
    await markSeen(email); // they're looking at it, no need to ping their phone
    return NextResponse.json(result);
  } catch (e) {
    // Google access removed: the app shows "Sign in again" (issue #10).
    if (e instanceof AccessRevoked) return NextResponse.json({ error: e.message, reauth: true }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await finishSync(email);
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
  let { data: users, error } = await db.from("users").select("email, last_synced_at, last_seen_at, access_revoked");
  if (error) {
    // Database not updated yet (no last_seen_at): treat everyone as daily.
    const r = await db.from("users").select("email, last_synced_at");
    users = (r.data ?? []).map((u) => ({ ...u, last_seen_at: null, access_revoked: null }));
    error = r.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const queue = dueForSync(users ?? [], started);
  const results: { email: string; fetched?: number; notified?: number; error?: string }[] = [];
  for (const u of queue) {
    if (Date.now() - started > BUDGET_MS) break;
    // the student's own app may be syncing them right now: skip, they're up to date
    if (!(await claimSync(u.email, 60))) {
      results.push({ email: mask(u.email), error: "busy" });
      continue;
    }
    try {
      const r = await syncUser(u.email);
      results.push({ email: mask(u.email), fetched: r.fetched, notified: await notifyStudent(u.email) });
    } catch (e) {
      // Revoked Google access is flagged by syncUser, so that student is skipped from now on.
      // Any other failure: move on and try again next round.
      await db.from("users").update({ last_synced_at: new Date().toISOString() }).eq("email", u.email);
      results.push({ email: mask(u.email), error: (e as Error).message.slice(0, 120) });
    } finally {
      await finishSync(u.email);
    }
  }
  // Deadline reminders for students who weren't due for a sync this round.
  const synced = new Set(queue.slice(0, results.length).map((u) => u.email));
  for (const u of users ?? []) if (u.access_revoked) synced.add(u.email); // no reminders for students who left
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
