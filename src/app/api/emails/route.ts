import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db, type Priority } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/types";
import { PAGE_SIZE, searchPattern } from "@/lib/inbox";
import { ensureLabels, getAccessToken, markRead, markUnread, setPriorityLabel } from "@/lib/gmail";
import { limited } from "@/lib/rate-limit";

async function currentUser() {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

// GET /api/emails                       newest mail, one page
//     ?before=<received_at>             the next older page (scrolling down)
//     ?q=<words>                        search all stored mail, not just what's loaded
//     ?due=1                            mail with an open or recent deadline, however old
//     ?priority=…&days=…&limit=…        optional narrowing
// Answers { emails, more, reauth }. `more` = there is an older page.
export async function GET(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "emails");
  if (tooMany) return tooMany;

  const p = req.nextUrl.searchParams;
  const priority = p.get("priority");
  const days = Number(p.get("days"));
  const before = p.get("before");
  const pattern = searchPattern(p.get("q") ?? "");
  const due = p.get("due") === "1";
  const limit = Math.min(500, Math.max(1, Number(p.get("limit")) || PAGE_SIZE));

  let query = db.from("emails").select("*").eq("user_email", email);
  if (days > 0) query = query.gte("received_at", new Date(Date.now() - days * 86400_000).toISOString());
  // lte, not lt: mails sharing the edge time aren't skipped; the app drops the repeats
  if (before && !Number.isNaN(Date.parse(before))) query = query.lte("received_at", new Date(before).toISOString());
  if (priority) query = query.eq("priority", priority);
  if (due) query = query.not("deadline", "is", null).gte("deadline", new Date(Date.now() - 7 * 86400_000).toISOString());
  if (pattern) query = query.or(["subject", "from_name", "from_address", "summary"].map((c) => `${c}.ilike.${pattern}`).join(","));

  const { data, error } = await query.order("received_at", { ascending: false }).limit(limit + 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const more = (data?.length ?? 0) > limit;

  // Opening the app marks the student as active, so background sync checks them more often.
  let reauth = false;
  let aiConsent: boolean | null | undefined;
  let syncProblem: string | null = null;
  if (!before && !pattern && !due) {
    await db.from("users").update({ last_seen_at: new Date().toISOString() }).eq("email", email);
    const { data: u } = await db.from("users").select("access_revoked, ai_consent, last_sync_error").eq("email", email).maybeSingle();
    reauth = !!u?.access_revoked; // issue #10
    aiConsent = u ? (u.ai_consent ?? null) : undefined; // #31: null = not asked yet
    syncProblem = u?.last_sync_error ?? null; // #40
  }
  return NextResponse.json({ emails: (data ?? []).slice(0, limit), more, reauth, aiConsent, syncProblem });
}

const Patch = z.object({
  id: z.string(),
  priority: z.enum(["very_important", "priority", "later", "noise"]).optional(),
  category: z.enum(CATEGORIES).optional(),
  is_done: z.boolean().optional(),
  read: z.boolean().optional(),
  /** false = move only this mail, don't make a rule for the sender (#46) */
  teach: z.boolean().optional(),
});

// PATCH: move a mail or recategorise it (teaches the sorter), mark it done,
// read or unread (mirrored in Gmail).
export async function PATCH(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "patch");
  if (tooMany) return tooMany;

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { id, priority, category, is_done, read, teach } = parsed.data;

  const update: Record<string, unknown> = {};
  if (priority) Object.assign(update, teach === false ? { priority, user_corrected: false, sorted_by: "manual" } : { priority, user_corrected: true });
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
