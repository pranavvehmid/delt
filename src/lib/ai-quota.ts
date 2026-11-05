// Sharing the one free Gemini key fairly between all students (issue #3).
// - When the shared key hits its free limit, every sync skips AI until the cooldown ends.
// - Each student gets a daily allowance on the shared key.
// - A student who adds their own free key isn't limited by either.
// Pure decisions live here (tested); sync.ts does the reads and writes.

export const SHARED_DAILY_PER_STUDENT = 25;
export const COOLDOWN_MS = 15 * 60_000;

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const istDay = (t: number) => IST_DAY.format(t);

export type AiPlan = { key: string | null; own: boolean; allowance: number; why: string };

/**
 * Which key to use and how many AI checks this sync may make.
 * `usedToday` is how many shared-key checks the student made on `usedDay`.
 */
export function planAI(opts: {
  /** The student's answer to "Let AI check unclear mail?" (#31). Only true allows AI. */
  consent?: boolean | null;
  ownKey: string | null;
  sharedKey: string | undefined;
  sharedCooldownUntil: number | null;
  usedDay: string | null;
  usedToday: number;
  now: number;
}): AiPlan {
  const { consent, ownKey, sharedKey, sharedCooldownUntil, usedDay, usedToday, now } = opts;
  if (consent !== true) return { key: null, own: false, allowance: 0, why: consent === false ? "rules only, by your choice" : "waiting for your OK" };
  if (ownKey) return { key: ownKey, own: true, allowance: Infinity, why: "own key" };
  if (!sharedKey) return { key: null, own: false, allowance: 0, why: "no AI key set up" };
  if (sharedCooldownUntil && sharedCooldownUntil > now) return { key: null, own: false, allowance: 0, why: "shared AI resting after its free limit" };
  const used = usedDay === istDay(now) ? usedToday : 0;
  const left = Math.max(0, SHARED_DAILY_PER_STUDENT - used);
  return left > 0 ? { key: sharedKey, own: false, allowance: left, why: "shared key" } : { key: null, own: false, allowance: 0, why: "today's shared AI checks used up" };
}

/** The new usage counter after `n` more shared-key checks. */
export function bumpUsage(usedDay: string | null, usedToday: number, n: number, now: number) {
  const today = istDay(now);
  return { ai_day: today, ai_calls: (usedDay === today ? usedToday : 0) + n };
}
