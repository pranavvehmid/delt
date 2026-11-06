import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { AccessRevoked, TooBig, attachmentHeaders, getAccessToken, getAttachment } from "@/lib/gmail";
import { markRevoked } from "@/lib/sync";
import { limited } from "@/lib/rate-limit";

// GET /api/emails/:id/attachments/:part — one file from a mail (#72), read live from Gmail for its
// owner only, the same rule as the mail itself. Nothing is stored.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; part: string }> }) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "attachment");
  if (tooMany) return tooMany;
  const { id, part } = await params;
  if (!/^[\w-]{1,64}$/.test(id) || !/^\d+(\.\d+){0,8}$/.test(part)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: row } = await db.from("emails").select("id").eq("id", id).eq("user_email", email).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: user } = await db.from("users").select("refresh_token").eq("email", email).single();
  if (!user) return NextResponse.json({ error: "Sign in again" }, { status: 401 });

  try {
    const token = await getAccessToken(user.refresh_token);
    const file = await getAttachment(token, id, part);
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new Response(new Uint8Array(file.bytes), { headers: attachmentHeaders(file.name, file.type, file.bytes.length) });
  } catch (e) {
    if (e instanceof TooBig) return NextResponse.json({ error: e.message }, { status: 413 });
    if (e instanceof AccessRevoked) {
      await markRevoked(email);
      return NextResponse.json({ error: e.message, reauth: true }, { status: 409 });
    }
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
