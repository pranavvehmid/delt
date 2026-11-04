import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db, type Priority } from "@/lib/supabase";
import { batchModify, ensureLabels, getAccessToken, LABEL_NAMES } from "@/lib/gmail";

// POST /api/emails/bulk — act on many mails at once (sender clean-up, "mark all read").
// Moving mail marks it as your choice, so future mail from those senders follows.
const Bulk = z.object({
  ids: z.array(z.string().max(100)).min(1).max(1000),
  read: z.boolean().optional(),
  priority: z.enum(["very_important", "priority", "later", "noise"]).optional(),
  is_done: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Bulk.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { ids, read, priority, is_done } = parsed.data;
  if (read === undefined && !priority && is_done === undefined) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  // Only this user's mail.
  const { data: owned } = await db.from("emails").select("id").eq("user_email", email).in("id", ids);
  const mine = (owned ?? []).map((r) => r.id);
  if (!mine.length) return NextResponse.json({ updated: 0 });

  const update: Record<string, unknown> = {};
  if (read !== undefined) update.unread = !read;
  if (priority) Object.assign(update, { priority, user_corrected: true, gmail_labeled: true });
  if (is_done !== undefined) update.is_done = is_done;
  const { error } = await db.from("emails").update(update).eq("user_email", email).in("id", mine);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror in Gmail with as few calls as possible.
  const { data: user } = await db.from("users").select("refresh_token").eq("email", email).single();
  if (user && (read !== undefined || priority)) {
    try {
      const token = await getAccessToken(user.refresh_token);
      if (read === true) await batchModify(token, mine, [], ["UNREAD"]);
      if (read === false) await batchModify(token, mine, ["UNREAD"], []);
      if (priority) {
        const labels = await ensureLabels(token);
        const others = (Object.keys(LABEL_NAMES) as Priority[]).filter((p) => p !== priority).map((p) => labels[p]);
        await batchModify(token, mine, [labels[priority]], others);
      }
    } catch (e) {
      console.error("Gmail bulk update failed:", (e as Error).message);
    }
  }
  return NextResponse.json({ updated: mine.length });
}
