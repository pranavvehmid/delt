import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db, type Priority } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/types";
import { ensureLabels, getAccessToken, markRead, markUnread, setPriorityLabel } from "@/lib/gmail";

async function currentUser() {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

// GET /api/emails?priority=very_important&days=30
export async function GET(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const priority = req.nextUrl.searchParams.get("priority");
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);

  let query = db
    .from("emails")
    .select("*")
    .eq("user_email", email)
    .gte("received_at", new Date(Date.now() - days * 86400_000).toISOString())
    .order("received_at", { ascending: false })
    .limit(500);
  if (priority) query = query.eq("priority", priority);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Opening the app marks the student as active, so background sync checks them more often.
  await db.from("users").update({ last_seen_at: new Date().toISOString() }).eq("email", email);
  return NextResponse.json({ emails: data });
}

const Patch = z.object({
  id: z.string(),
  priority: z.enum(["very_important", "priority", "later", "noise"]).optional(),
  category: z.enum(CATEGORIES).optional(),
  is_done: z.boolean().optional(),
  read: z.boolean().optional(),
});

// PATCH: move a mail or recategorise it (teaches the sorter), mark it done,
// read or unread (mirrored in Gmail).
export async function PATCH(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { id, priority, category, is_done, read } = parsed.data;

  const update: Record<string, unknown> = {};
  if (priority) Object.assign(update, { priority, user_corrected: true });
  if (category) Object.assign(update, { category, user_corrected: true });
  if (is_done !== undefined) update.is_done = is_done;
  if (read !== undefined) update.unread = !read;

  const { error } = await db.from("emails").update(update).eq("id", id).eq("user_email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (priority || read !== undefined) {
    // Keep Gmail in step with the website: priority label and read state.
    const { data: user } = await db.from("users").select("refresh_token").eq("email", email).single();
    if (user) {
      try {
        const token = await getAccessToken(user.refresh_token);
        if (priority) await setPriorityLabel(token, id, priority as Priority, await ensureLabels(token));
        if (read === true) await markRead(token, id);
        if (read === false) await markUnread(token, id);
      } catch (e) {
        console.error("Gmail update failed:", (e as Error).message);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
