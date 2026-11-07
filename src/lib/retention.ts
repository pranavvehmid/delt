import "server-only";
// #38: old mail previews don't stay forever. Mail the student moved by hand is kept: those rows are
// their sorting rules.
// #90: runs once a day on its own clock (app_state.last_purge), not only when a background round
// happens to finish its whole queue, which at scale it never does.
// #125: deletes in small batches within a time limit, never one statement over the whole table.
import { db } from "./supabase";

export const KEEP_DAYS = 180;
export const PURGE_EVERY_MS = 20 * 3600_000;
const BATCH = 200;
const TIME_LIMIT_MS = 15_000;

export const retentionCutoff = (now: number) => new Date(now - KEEP_DAYS * 86400_000).toISOString();

/** Is a purge due? (once per PURGE_EVERY_MS, remembered in app_state) */
export function purgeDue(lastPurge: number | null, now: number) {
  return !lastPurge || now - lastPurge >= PURGE_EVERY_MS;
}

/** Deletes mail older than KEEP_DAYS for every student, except mail they moved, in batches.
 *  Returns how many rows went. */
export async function purgeOldMail(now = Date.now()): Promise<number> {
  const cutoff = retentionCutoff(now);
  const started = Date.now();
  let total = 0;
  while (Date.now() - started < TIME_LIMIT_MS) {
    const { data: old, error } = await db
      .from("emails")
      .select("id, user_email")
      .lt("received_at", cutoff)
      .eq("user_corrected", false)
      .limit(BATCH);
    if (error) {
      console.warn("Retention clean-up failed:", error.message);
      break;
    }
    if (!old?.length) break;
    // one student at a time, so a Gmail id shared by two mailboxes can't delete the wrong row
    const byStudent = new Map<string, string[]>();
    for (const r of old) byStudent.set(r.user_email, [...(byStudent.get(r.user_email) ?? []), r.id]);
    for (const [student, ids] of byStudent) {
      const { count } = await db
        .from("emails")
        .delete({ count: "exact" })
        .eq("user_email", student)
        .in("id", ids)
        .lt("received_at", cutoff)
        .eq("user_corrected", false);
      total += count ?? 0;
    }
    if (old.length < BATCH) break;
  }
  return total;
}

/** #90: purge if a day has passed since the last one, and remember when. */
export async function purgeIfDue(now = Date.now()): Promise<number> {
  const { data } = await db.from("app_state").select("value").eq("key", "last_purge").maybeSingle();
  const last = Number((data?.value as { at?: number } | undefined)?.at) || null;
  if (!purgeDue(last, now)) return 0;
  await db.from("app_state").upsert({ key: "last_purge", value: { at: now }, updated_at: new Date(now).toISOString() });
  return purgeOldMail(now);
}
