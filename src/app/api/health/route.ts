import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/supabase";
import { syncHealth } from "@/lib/schedule";

// GET /api/health with "Authorization: Bearer <CRON_SECRET>" (#40): is background sync keeping up?
// Counts only, never addresses. The GitHub job warns when active students are over 2 hours behind.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET, header = req.headers.get("authorization");
  const ok = !!secret && !!header && header.length === secret.length + 7 && timingSafeEqual(Buffer.from(header), Buffer.from(`Bearer ${secret}`));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db.from("users").select("last_synced_at, last_seen_at, last_sync_error, access_revoked");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(syncHealth(data ?? [], Date.now()), { headers: { "Cache-Control": "no-store" } });
}
