// What one sync run does with the mail Gmail lists, and when it may move last_synced_at (issue #28).
// Pure functions, tested in tests/sync-plan.test.ts.
//
// The rule: last_synced_at only moves forward when every new mail in the window was saved.
// Otherwise it stays put, and the next run lists the same window again, skips what it already
// has, and carries on. Nothing is skipped for good.

/** Ids listed per run (cheap: 500 per Gmail call). */
export const LIST_MAX = 2000;
/** Mails downloaded and sorted per run (each is a Gmail call, maybe an AI call). */
export const BATCH = 150;
/** A mail that keeps failing doesn't hold the window open for longer than this. */
export const MAX_STUCK_MS = 3 * 86400_000;

export function planSync(listed: string[], known: Set<string>, cap = BATCH) {
  const todo = listed.filter((id) => !known.has(id));
  return { batch: todo.slice(0, cap), left: Math.max(0, todo.length - cap), listCapped: listed.length >= LIST_MAX };
}

export function nextSyncedAt(o: { previous: string | null; startedAt: string; left: number; failed: number }): string | null {
  if (o.left > 0) return o.previous; // more to download next run
  if (o.failed > 0) {
    const stuckFor = o.previous ? Date.parse(o.startedAt) - Date.parse(o.previous) : 0;
    if (stuckFor < MAX_STUCK_MS) return o.previous; // retry the failures next run
  }
  return o.startedAt;
}

/** A message deleted between listing and downloading isn't a failure: there's nothing to save. */
export const isGone = (message: string) => /\((404|410)\)/.test(message);

// ---------- #29: mirroring Gmail's unread state ----------
export const UNREAD_WINDOW_DAYS = 60;
export const UNREAD_LIST_MAX = 2000;

/** Which rows to mark read or unread, given the unread ids Gmail listed for the last 60 days.
 *  `flaggedInWindow`: rows DELT has as unread, received in the same 60 days (older rows are left alone).
 *  If Gmail's list was cut off at the cap, nothing is marked read: a mail missing from the list
 *  may just be past the cap. */
export function unreadChanges(flaggedInWindow: string[], unreadNow: string[], listCapped: boolean) {
  const now = new Set(unreadNow);
  return {
    markRead: listCapped ? [] : flaggedInWindow.filter((id) => !now.has(id)),
    markUnread: unreadNow,
  };
}
