import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { serverError } from "@/lib/api-error";
import { db } from "@/lib/supabase";
import { RULES_MAX, senderRules } from "@/lib/inbox";
import { limited } from "@/lib/rate-limit";

// Sender rules (issue #13). Moving a mail to another pile teaches DELT where that sender's
// mail goes. GET lists them; DELETE ?from=<address> forgets one. Mails already sorted stay put.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "rules");
  if (tooMany) return tooMany;

  const { data, error } = await db
    .from("emails")
    .select("from_address, from_name, priority, received_at")
    .eq("user_email", email)
    .eq("user_corrected", true)
    .order("received_at", { ascending: false }) // #114: newest move first, same as the sorter
    .limit(RULES_MAX);
  if (error) return serverError("rules", error);
  return NextResponse.json({ rules: senderRules(data ?? []) });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "rules");
  if (tooMany) return tooMany;
  const from = req.nextUrl.searchParams.get("from")?.trim();
  if (!from || from.length > 320) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { error } = await db.from("emails").update({ user_corrected: false }).eq("user_email", email).ilike("from_address", from.replace(/[%_\\]/g, "\\$&")); // exact address, any case
  if (error) return serverError("rules", error);
  return NextResponse.json({ ok: true });
}
