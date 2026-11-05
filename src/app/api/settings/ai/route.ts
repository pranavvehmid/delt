import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { looksLikeGeminiKey, open, seal } from "@/lib/secret";
import { SHARED_DAILY_PER_STUDENT, planAI } from "@/lib/ai-quota";

// The student's AI sorting settings: use the shared free key, or add their own free Gemini key.
async function currentUser() {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

// GET: how AI sorting works for this student right now.
export async function GET() {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: user } = await db.from("users").select("gemini_key_enc, ai_day, ai_calls").eq("email", email).maybeSingle();
  const { data: state } = await db.from("app_state").select("value").eq("key", "gemini_cooldown_until").maybeSingle();
  const plan = planAI({
    ownKey: open(user?.gemini_key_enc),
    sharedKey: process.env.GEMINI_API_KEY,
    sharedCooldownUntil: Number((state?.value as { until?: number } | undefined)?.until) || null,
    usedDay: user?.ai_day ?? null,
    usedToday: user?.ai_calls ?? 0,
    now: Date.now(),
  });
  return NextResponse.json({
    ownKey: plan.own,
    sharedAvailable: !!process.env.GEMINI_API_KEY,
    leftToday: plan.own ? null : plan.allowance,
    perDay: SHARED_DAILY_PER_STUDENT,
    status: plan.why,
  });
}

const Body = z.object({ key: z.string().trim().min(1).max(200) });

// POST: save the student's own key, after checking it works.
export async function POST(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !looksLikeGeminiKey(parsed.data.key)) return NextResponse.json({ error: "That doesn't look like a Gemini API key" }, { status: 400 });

  const check = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
    headers: { "x-goog-api-key": parsed.data.key },
  }).catch(() => null);
  if (!check || !check.ok) return NextResponse.json({ error: "Google didn't accept that key" }, { status: 400 });

  const { error } = await db.from("users").update({ gemini_key_enc: seal(parsed.data.key) }).eq("email", email);
  if (error) return NextResponse.json({ error: "Couldn't save the key" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: go back to the shared key.
export async function DELETE() {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await db.from("users").update({ gemini_key_enc: null }).eq("email", email);
  return NextResponse.json({ ok: true });
}
