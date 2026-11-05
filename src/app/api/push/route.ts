import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { pushEnabled, sendToStudent } from "@/lib/notify";

// Phone notifications: save or remove this device's push subscription.
async function currentUser() {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

// GET: the public key the browser needs to subscribe.
export async function GET() {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ enabled: pushEnabled(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}

const Sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }),
});

// POST: turn notifications on for this device, and send a test.
export async function POST(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!pushEnabled()) return NextResponse.json({ error: "Notifications aren't set up on this server" }, { status: 503 });
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  const { error } = await db.from("push_subscriptions").upsert({ endpoint, user_email: email, p256dh: keys.p256dh, auth: keys.auth });
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  await sendToStudent(email, { title: "Notifications are on", body: "You'll hear about urgent mail and deadlines due within a day.", url: "/#/inbox", tag: "welcome" });
  return NextResponse.json({ ok: true });
}

// DELETE: turn notifications off for this device.
export async function DELETE(req: NextRequest) {
  const email = await currentUser();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (endpoint) await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_email", email);
  return NextResponse.json({ ok: true });
}
