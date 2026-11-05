import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { senderRules } from "@/lib/inbox";

// Sender rules (issue #13). Moving a mail to another pile teaches DELT where that sender's
// mail goes. GET lists them; DELETE ?from=<address> forgets one. Mails already sorted stay put.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await db
    .from("emails")
    .select("from_address, from_name, priority, received_at")
    .eq("user_email", email)
    .eq("user_corrected", true)
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: senderRules(data ?? []) });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from")?.trim();
  if (!from || from.length > 320) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { error } = await db.from("emails").update({ user_corrected: false }).eq("user_email", email).ilike("from_address", from.replace(/[%_\\]/g, "\\$&")); // exact address, any case
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
