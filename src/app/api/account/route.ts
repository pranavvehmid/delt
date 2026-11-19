import { NextResponse, type NextRequest } from "next/server";
import { auth, signOut } from "@/auth";
import { serverError } from "@/lib/api-error";
import { db } from "@/lib/supabase";
import { deleteStudentData, type AccountDb } from "@/lib/account";
import { getAccessToken, removeDeltLabels, revokeGoogleToken } from "@/lib/gmail";
import { limited } from "@/lib/rate-limit";
import { allRows } from "@/lib/all-rows";
import { RULES_MAX, senderRules } from "@/lib/inbox";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "accountExport");
  if (tooMany) return tooMany;

  try {
    const [profile, previews, devices] = await Promise.all([
      db.from("users").select("created_at, ai_consent").eq("email", email).maybeSingle(),
      allRows((from, to) => db.from("emails")
        .select("id, thread_id, from_name, from_address, subject, snippet, summary, received_at, priority, category, reason, deadline, deadline_choice, user_corrected, is_done, unread")
        .eq("user_email", email).order("received_at", { ascending: false }).order("id").range(from, to)),
      db.from("push_subscriptions").select("created_at", { count: "exact", head: true }).eq("user_email", email),
    ]);
    const error = profile.error ?? previews.error ?? devices.error;
    if (error) return serverError("account export", error);

    const metadata = {
      version: 1,
      exportedAt: new Date().toISOString(),
      account: email,
      settings: {
        createdAt: profile.data?.created_at ?? null,
        aiConsent: profile.data?.ai_consent ?? null,
        notificationDevices: devices.count ?? 0,
      },
      rules: senderRules(previews.data.filter((row) => row.user_corrected).slice(0, RULES_MAX)),
    };
    const encoder = new TextEncoder();
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(metadata).slice(0, -1) + ',"previews":['));
      },
      pull(controller) {
        const rows = previews.data.slice(index, index + 100);
        if (!rows.length) {
          controller.enqueue(encoder.encode("]}"));
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode((index ? "," : "") + rows.map((row) => JSON.stringify(row)).join(",")));
        index += rows.length;
      },
    });
    return new Response(body, { headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="delt-data.json"',
    } });
  } catch (e) {
    return serverError("account export", e);
  }
}

// DELETE /api/account  { removeLabels?: boolean }
// "Delete my data" (issue #9): the signed-in student's rows go from every table, DELT's Google
// access is revoked, and (if asked) the DELT labels are removed from their Gmail.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const tooMany = limited(email, "account");
  if (tooMany) return tooMany;

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
    return serverError("account delete", e);
  }
}
