import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { AccessRevoked, getAccessToken, getFullMessage } from "@/lib/gmail";
import { markRevoked } from "@/lib/sync";

// GET /api/emails/:id — the full original mail, fetched live from Gmail.
// DELT never stores mail bodies; this reads it on demand for the signed-in owner only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  // Only mail that belongs to this user.
  const { data: row } = await db.from("emails").select("id").eq("id", id).eq("user_email", email).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: user } = await db.from("users").select("refresh_token").eq("email", email).single();
  if (!user) return NextResponse.json({ error: "Sign in again" }, { status: 401 });

  try {
    const token = await getAccessToken(user.refresh_token);
    const msg = await getFullMessage(token, id);
    return NextResponse.json(msg, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof AccessRevoked) {
      await markRevoked(email);
      return NextResponse.json({ error: e.message, reauth: true }, { status: 409 });
    }
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
