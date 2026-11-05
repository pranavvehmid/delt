import { NextResponse, type NextRequest } from "next/server";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/supabase";
import { deleteStudentData, type AccountDb } from "@/lib/account";
import { getAccessToken, removeDeltLabels, revokeGoogleToken } from "@/lib/gmail";

// DELETE /api/account  { removeLabels?: boolean }
// "Delete my data" (issue #9): the signed-in student's rows go from every table, DELT's Google
// access is revoked, and (if asked) the MailSort labels are removed from their Gmail.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  try {
    const report = await deleteStudentData(email, db as unknown as AccountDb, {
      accessToken: getAccessToken,
      removeLabels: removeDeltLabels,
      revoke: revokeGoogleToken,
    }, { removeLabels: body?.removeLabels === true });
    await signOut({ redirect: false });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
