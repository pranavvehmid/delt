import "server-only";
// #38: old mail previews don't stay forever. Run by background sync once per call.
// Mail the student moved by hand is kept: those rows are their sorting rules.
import { db } from "./supabase";

export const KEEP_DAYS = 180;
export const retentionCutoff = (now: number) => new Date(now - KEEP_DAYS * 86400_000).toISOString();

/** Deletes mail older than KEEP_DAYS for every student, except mail they moved. Returns the count. */
export async function purgeOldMail(now = Date.now()): Promise<number> {
  const { count, error } = await db
    .from("emails")
    .delete({ count: "exact" })
    .lt("received_at", retentionCutoff(now))
    .eq("user_corrected", false);
  if (error) console.warn("Retention clean-up failed:", error.message);
  return count ?? 0;
}
