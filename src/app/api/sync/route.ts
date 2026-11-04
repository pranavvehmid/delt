import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { syncUser } from "@/lib/sync";

export const maxDuration = 60;

// POST: "Refresh" button on the dashboard, syncs the signed-in user.
export async function POST() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    return NextResponse.json(await syncUser(email));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// GET: called by Vercel Cron. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Least recently synced students first; stop before the function time limit.
  // Anyone skipped is first in line next time (or syncs when they open the site).
  const started = Date.now();
  const { data: users } = await db
    .from("users")
    .select("email")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(50);
  const results = [];
  for (const u of users ?? []) {
    if (Date.now() - started > 15_000) break;
    results.push(await syncUser(u.email).catch((e) => ({ email: u.email, error: (e as Error).message })));
  }
  return NextResponse.json({ results });
}
